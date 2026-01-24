"""
Virtual Try-On API Server
FastAPI backend for the Virtual Try-On Chrome Extension

Features:
- Image proxy to bypass CORS
- Virtual try-on using Replicate AI
- Body measurement analysis
"""

import os
import time
import base64
import uuid
import hashlib
from io import BytesIO
from typing import Optional
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
from PIL import Image
import httpx

from dotenv import load_dotenv

load_dotenv()

# Check for API tokens
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN")
HUGGINGFACE_API_TOKEN = os.getenv("HUGGINGFACE_API_TOKEN") or os.getenv("HF_TOKEN")
FAL_API_KEY = os.getenv("FAL_KEY") or os.getenv("FAL_API_KEY")

USE_REPLICATE = bool(REPLICATE_API_TOKEN)
USE_HUGGINGFACE = True  # Kolors is free and doesn't require a token
USE_FAL = bool(FAL_API_KEY)

if USE_REPLICATE:
    import replicate

print(f"[TryOn] AI backends: Replicate={USE_REPLICATE}, Fal={USE_FAL}, HuggingFace(Kolors)={USE_HUGGINGFACE}")

app = FastAPI(
    title="Virtual Try-On API",
    description="AI-powered virtual try-on service for clothing",
    version="1.0.0"
)

# CORS configuration for Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Chrome extensions use chrome-extension:// URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Simple in-memory cache for proxied images
image_cache: dict[str, bytes] = {}
CACHE_MAX_SIZE = 100


# ============================================================================
# Models
# ============================================================================

class Measurements(BaseModel):
    height: Optional[float] = Field(None, description="Height in cm")
    weight: Optional[float] = Field(None, description="Weight in kg")
    chest: Optional[float] = Field(None, description="Chest circumference in cm")
    waist: Optional[float] = Field(None, description="Waist circumference in cm")
    hips: Optional[float] = Field(None, description="Hip circumference in cm")
    inseam: Optional[float] = Field(None, description="Inseam length in cm")
    shoulder_width: Optional[float] = Field(None, alias="shoulderWidth")
    arm_length: Optional[float] = Field(None, alias="armLength")

    class Config:
        populate_by_name = True


class TryOnRequest(BaseModel):
    user_photo: str = Field(..., alias="userPhoto", description="Base64 encoded user photo")
    product_image: str = Field(..., alias="productImage", description="Product image URL or base64")
    measurements: Optional[Measurements] = None
    garment_type: str = Field("top", alias="garmentType")
    fast_mode: bool = Field(True, alias="fastMode", description="Use fast mode (smaller images, fewer steps)")

    class Config:
        populate_by_name = True


class TryOnResponse(BaseModel):
    success: bool
    result_image: Optional[str] = Field(None, alias="resultImage")
    error: Optional[str] = None
    processing_time: Optional[float] = Field(None, alias="processingTime")
    request_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    method: str = "composite"  # "ai" or "composite"

    class Config:
        populate_by_name = True


class HealthResponse(BaseModel):
    status: str
    version: str
    ai_enabled: bool
    replicate_configured: bool
    fal_configured: bool
    huggingface_configured: bool
    kolors_available: bool = True  # Kolors is always available (free)


# ============================================================================
# Helper Functions
# ============================================================================

def decode_base64_image(base64_string: str) -> Image.Image:
    """Decode base64 string to PIL Image."""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    image_data = base64.b64decode(base64_string)
    return Image.open(BytesIO(image_data))


def encode_image_to_base64(image: Image.Image, format: str = "JPEG") -> str:
    """Encode PIL Image to base64 string."""
    buffer = BytesIO()
    if image.mode == 'RGBA' and format == 'JPEG':
        image = image.convert('RGB')
    image.save(buffer, format=format, quality=90)
    buffer.seek(0)
    base64_string = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/{format.lower()};base64,{base64_string}"


def image_to_data_uri(image: Image.Image) -> str:
    """Convert PIL Image to data URI for Replicate API."""
    buffer = BytesIO()
    if image.mode == 'RGBA':
        image = image.convert('RGB')
    image.save(buffer, format='JPEG', quality=90)
    buffer.seek(0)
    base64_string = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/jpeg;base64,{base64_string}"


async def fetch_image_bytes(url: str) -> bytes:
    """Fetch image from URL and return bytes."""
    # Check cache first
    cache_key = hashlib.md5(url.encode()).hexdigest()
    if cache_key in image_cache:
        return image_cache[cache_key]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": urlparse(url).scheme + "://" + urlparse(url).netloc + "/",
    }
    
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        
        # Cache the result
        if len(image_cache) >= CACHE_MAX_SIZE:
            # Remove oldest entry
            oldest = next(iter(image_cache))
            del image_cache[oldest]
        image_cache[cache_key] = response.content
        
        return response.content


async def fetch_product_image(url: str) -> Image.Image:
    """Fetch product image from URL."""
    content = await fetch_image_bytes(url)
    return Image.open(BytesIO(content))


def preprocess_image(image: Image.Image, max_size: tuple = (768, 1024), fast_mode: bool = False) -> Image.Image:
    """
    Preprocess image for model.
    
    fast_mode=True: Uses smaller image size (512px) for faster processing
    fast_mode=False: Uses full size (768px) for best quality
    """
    if fast_mode:
        # Reduce size for faster transfer and processing
        max_size = (512, 680) if max_size[0] >= max_size[1] else (512, 512)
    
    image.thumbnail(max_size, Image.Resampling.LANCZOS)
    if image.mode not in ('RGB', 'RGBA'):
        image = image.convert('RGB')
    return image


def get_garment_description(garment_type: str) -> str:
    """Generate detailed garment description for AI model."""
    descriptions = {
        "top": "A fashionable top, casual wear, fitted style",
        "shirt": "A button-up shirt, formal or casual, well-fitted",
        "sweater": "A cozy knit sweater, comfortable fit",
        "cardigan": "A stylish cardigan sweater, open front, elegant drape",
        "jacket": "A tailored jacket, structured fit, outerwear",
        "dress": "An elegant dress, flattering silhouette",
        "pants": "Well-fitted pants, tailored cut",
        "jeans": "Classic denim jeans, modern fit",
        "shorts": "Casual shorts, comfortable fit",
        "skirt": "A stylish skirt, flattering length",
    }
    return descriptions.get(garment_type, f"A {garment_type} clothing item, well-fitted, stylish")


async def generate_tryon_replicate(
    user_photo: Image.Image,
    garment_image: Image.Image,
    garment_type: str
) -> Image.Image:
    """
    Generate virtual try-on using Replicate API.
    Tries multiple models for best results.
    """
    if not USE_REPLICATE:
        raise ValueError("Replicate API token not configured")
    
    # Convert images to data URIs
    user_uri = image_to_data_uri(user_photo)
    garment_uri = image_to_data_uri(garment_image)
    
    # Determine body category
    is_upper = garment_type in ["top", "shirt", "sweater", "cardigan", "jacket", "dress"]
    category = "upper_body" if is_upper else "lower_body"
    if garment_type == "dress":
        category = "dresses"
    
    # Detailed garment description for better results
    garment_desc = get_garment_description(garment_type)
    
    print(f"[TryOn] Generating with Replicate - type: {garment_type}, category: {category}")
    
    # Try IDM-VTON model (best for virtual try-on)
    try:
        output = replicate.run(
            "cuuupid/idm-vton:c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3ff4",
            input={
                "crop": False,
                "seed": 42,
                "steps": 40,  # More steps for better quality
                "category": category,
                "force_dc": False,
                "human_img": user_uri,
                "garm_img": garment_uri,
                "garment_des": garment_desc,
            }
        )
        
        if output:
            result_url = str(output)
            print(f"[TryOn] IDM-VTON success, fetching result from: {result_url[:50]}...")
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(result_url)
                response.raise_for_status()
                return Image.open(BytesIO(response.content))
                
    except Exception as e:
        print(f"[TryOn] IDM-VTON failed: {e}")
    
    # Fallback: Try OOTDiffusion model
    try:
        print("[TryOn] Trying OOTDiffusion model...")
        output = replicate.run(
            "levihsu/ootdiffusion:dc2f0c870be33de6e66ae3d348564e13e42523a1dff8c3a3d91def0a5c3bf5d5",
            input={
                "seed": 42,
                "steps": 30,
                "model_type": "hd" if is_upper else "dc",
                "category": 0 if is_upper else 1,  # 0=upperbody, 1=lowerbody
                "human_img": user_uri,
                "garment_img": garment_uri,
                "guidance_scale": 2.5,
                "num_inference_steps": 30,
            }
        )
        
        if output and len(output) > 0:
            result_url = output[0] if isinstance(output, list) else str(output)
            print(f"[TryOn] OOTDiffusion success")
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(result_url)
                response.raise_for_status()
                return Image.open(BytesIO(response.content))
                
    except Exception as e:
        print(f"[TryOn] OOTDiffusion failed: {e}")
    
    raise ValueError("All Replicate models failed")


async def generate_tryon_fal(
    user_photo: Image.Image,
    garment_image: Image.Image,
    garment_type: str,
    fast_mode: bool = True
) -> Image.Image:
    """
    Generate virtual try-on using Fal.ai API.
    Fal.ai is fast, reliable, and cost-effective (~$0.01/image).
    
    fast_mode=True: 20 steps (~8-12 sec), good quality
    fast_mode=False: 30 steps (~15-20 sec), best quality
    """
    if not USE_FAL:
        raise ValueError("Fal.ai API key not configured")
    
    # Convert images to base64 data URIs
    user_uri = image_to_data_uri(user_photo)
    garment_uri = image_to_data_uri(garment_image)
    
    # Determine category
    is_upper = garment_type in ["top", "shirt", "sweater", "cardigan", "jacket", "dress"]
    category = "upper_body" if is_upper else "lower_body"
    if garment_type == "dress":
        category = "dresses"
    
    # Fast mode uses fewer steps for quicker results
    num_steps = 20 if fast_mode else 30
    
    print(f"[TryOn] Using Fal.ai IDM-VTON, category: {category}, steps: {num_steps}")
    
    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            response = await client.post(
                "https://fal.run/fal-ai/idm-vton",
                headers={
                    "Authorization": f"Key {FAL_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "human_image_url": user_uri,
                    "garment_image_url": garment_uri,
                    "description": get_garment_description(garment_type),
                    "category": category,
                    "num_inference_steps": num_steps,
                    "seed": 42,
                    "guidance_scale": 2.0 if fast_mode else 2.5  # Slightly lower for speed
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"[TryOn] Fal.ai response: {list(result.keys())}")
                
                # Get the result image URL
                if "image" in result:
                    image_url = result["image"].get("url") if isinstance(result["image"], dict) else result["image"]
                elif "images" in result and len(result["images"]) > 0:
                    image_url = result["images"][0].get("url") if isinstance(result["images"][0], dict) else result["images"][0]
                else:
                    raise ValueError(f"Unexpected Fal response format: {result}")
                
                # Fetch the generated image
                img_response = await client.get(image_url)
                img_response.raise_for_status()
                return Image.open(BytesIO(img_response.content))
            else:
                error_text = response.text[:500]
                print(f"[TryOn] Fal.ai error {response.status_code}: {error_text}")
                raise ValueError(f"Fal.ai returned {response.status_code}")
                
    except Exception as e:
        print(f"[TryOn] Fal.ai error: {e}")
        raise


async def generate_tryon_huggingface(
    user_photo: Image.Image,
    garment_image: Image.Image,
    garment_type: str
) -> Image.Image:
    """
    Generate virtual try-on using Hugging Face Spaces via Gradio Client.
    Tries Kolors Virtual Try-On first (free, good quality), then IDM-VTON as fallback.
    """
    from gradio_client import Client, handle_file
    import tempfile
    import asyncio
    
    # Save images to temp files for Gradio client
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as user_file:
        user_photo_rgb = user_photo.convert('RGB') if user_photo.mode != 'RGB' else user_photo
        user_photo_rgb.save(user_file, format='JPEG', quality=95)
        user_path = user_file.name
    
    with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as garment_file:
        garment_rgb = garment_image.convert('RGB') if garment_image.mode != 'RGB' else garment_image
        garment_rgb.save(garment_file, format='JPEG', quality=95)
        garment_path = garment_file.name
    
    try:
        # Try Kolors Virtual Try-On first (free, no GPU quota limits)
        print("[TryOn] Connecting to Kolors Virtual Try-On Space...")
        
        def run_kolors_prediction():
            try:
                client = Client("Kwai-Kolors/Kolors-Virtual-Try-On")
                
                result = client.predict(
                    person_img=handle_file(user_path),
                    garment_img=handle_file(garment_path),
                    seed=42,
                    randomize_seed=False,
                    api_name="/tryon"
                )
                
                return ("kolors", result)
            except Exception as e:
                print(f"[TryOn] Kolors Gradio error: {e}")
                return None
        
        # Run in thread pool to not block async
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, run_kolors_prediction)
        
        if result and result[0] == "kolors":
            kolors_result = result[1]
            print(f"[TryOn] Kolors result type: {type(kolors_result)}")
            
            # Handle Kolors result format
            if isinstance(kolors_result, tuple) and len(kolors_result) > 0:
                result_item = kolors_result[0]
                if isinstance(result_item, str) and os.path.exists(result_item):
                    print("[TryOn] Kolors generation successful!")
                    return Image.open(result_item)
                elif isinstance(result_item, dict) and 'path' in result_item:
                    print("[TryOn] Kolors generation successful!")
                    return Image.open(result_item['path'])
            elif isinstance(kolors_result, str) and os.path.exists(kolors_result):
                print("[TryOn] Kolors generation successful!")
                return Image.open(kolors_result)
            elif isinstance(kolors_result, dict) and 'path' in kolors_result:
                print("[TryOn] Kolors generation successful!")
                return Image.open(kolors_result['path'])
            
            print(f"[TryOn] Unexpected Kolors result format: {kolors_result}")
        
        # Fallback to IDM-VTON Space
        print("[TryOn] Trying IDM-VTON as fallback...")
        
        def run_idm_vton_prediction():
            try:
                client = Client("yisol/IDM-VTON", hf_token=HUGGINGFACE_API_TOKEN)
                
                result = client.predict(
                    dict={"background": handle_file(user_path), "layers": [], "composite": None},
                    garm_img=handle_file(garment_path),
                    garment_des=get_garment_description(garment_type),
                    is_checked=True,  # Auto-masking
                    is_checked_crop=False,  # Don't auto crop
                    denoise_steps=30,
                    seed=42,
                    api_name="/tryon"
                )
                
                return result
            except Exception as e:
                print(f"[TryOn] IDM-VTON Gradio error: {e}")
                return None
        
        result = await loop.run_in_executor(None, run_idm_vton_prediction)
        
        if result:
            print(f"[TryOn] IDM-VTON result type: {type(result)}")
            # Result could be a file path or tuple
            if isinstance(result, str) and os.path.exists(result):
                return Image.open(result)
            elif isinstance(result, tuple) and len(result) > 0:
                result_path = result[0]
                if isinstance(result_path, str) and os.path.exists(result_path):
                    return Image.open(result_path)
            elif isinstance(result, dict) and 'path' in result:
                return Image.open(result['path'])
            
            print(f"[TryOn] Unexpected result format: {result}")
            
    except Exception as e:
        print(f"[TryOn] Gradio client error: {e}")
    finally:
        # Cleanup temp files
        import os as os_module
        try:
            os_module.unlink(user_path)
            os_module.unlink(garment_path)
        except:
            pass
    
    raise ValueError("Hugging Face model failed - try Replicate for reliable results")


def generate_composite_tryon(
    user_photo: Image.Image,
    garment_image: Image.Image,
    garment_type: str
) -> Image.Image:
    """
    Generate a sophisticated composite try-on image.
    Uses advanced blending techniques for more realistic results.
    """
    from PIL import ImageFilter, ImageEnhance
    
    # Ensure RGBA mode for alpha compositing
    result = user_photo.copy().convert('RGBA')
    garment = garment_image.copy().convert('RGBA')
    
    user_width, user_height = result.size
    
    # Calculate garment positioning based on type
    if garment_type in ["pants", "jeans", "shorts", "skirt"]:
        # Lower body garment
        scale_width = 0.55
        y_position_ratio = 0.42
        max_height_ratio = 0.55
    elif garment_type == "dress":
        # Full body garment
        scale_width = 0.6
        y_position_ratio = 0.12
        max_height_ratio = 0.75
    else:
        # Upper body garment (tops, shirts, sweaters, etc.)
        scale_width = 0.58
        y_position_ratio = 0.12
        max_height_ratio = 0.50
    
    # Calculate new garment dimensions
    new_width = int(user_width * scale_width)
    aspect_ratio = garment.width / garment.height
    new_height = int(new_width / aspect_ratio)
    
    # Limit height
    max_height = int(user_height * max_height_ratio)
    if new_height > max_height:
        new_height = max_height
        new_width = int(new_height * aspect_ratio)
    
    # Resize garment with high quality
    garment_resized = garment.resize((new_width, new_height), Image.Resampling.LANCZOS)
    
    # Position garment (centered horizontally)
    x_offset = (user_width - new_width) // 2
    y_offset = int(user_height * y_position_ratio)
    
    # Create semi-transparent garment overlay
    # Extract alpha channel and modify for better blending
    if garment_resized.mode == 'RGBA':
        r, g, b, a = garment_resized.split()
        # Enhance the alpha to make garment more visible but still blend
        a = ImageEnhance.Brightness(a).enhance(1.2)
        garment_resized = Image.merge('RGBA', (r, g, b, a))
    
    # Apply slight blur to edges for smoother blending
    garment_blurred = garment_resized.filter(ImageFilter.GaussianBlur(radius=1))
    
    # Create the overlay layer
    overlay = Image.new('RGBA', result.size, (0, 0, 0, 0))
    
    # Paste the garment onto the overlay
    if garment_resized.mode == 'RGBA':
        overlay.paste(garment_resized, (x_offset, y_offset), garment_resized)
    else:
        overlay.paste(garment_resized, (x_offset, y_offset))
    
    # Blend the overlay with the original image
    # Use alpha composite for proper transparency handling
    result = Image.alpha_composite(result, overlay)
    
    # Add a subtle shadow under the garment for depth
    shadow_overlay = Image.new('RGBA', result.size, (0, 0, 0, 0))
    shadow = garment_resized.copy()
    if shadow.mode == 'RGBA':
        # Create shadow from alpha channel
        r, g, b, a = shadow.split()
        shadow = Image.merge('RGBA', (
            Image.new('L', shadow.size, 0),
            Image.new('L', shadow.size, 0),
            Image.new('L', shadow.size, 0),
            ImageEnhance.Brightness(a).enhance(0.3)
        ))
        shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
        shadow_overlay.paste(shadow, (x_offset + 5, y_offset + 5), shadow)
    
    # Composite shadow behind the main result
    final = Image.alpha_composite(
        Image.alpha_composite(user_photo.copy().convert('RGBA'), shadow_overlay),
        overlay
    )
    
    # Add "Preview Mode" watermark
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(final)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        except:
            font = ImageFont.load_default()
    
    # Draw badge
    badge_text = "✨ Preview - AI Try-On Available"
    text_bbox = draw.textbbox((0, 0), badge_text, font=font)
    text_width = text_bbox[2] - text_bbox[0]
    padding = 8
    
    # Position at bottom right
    badge_x = user_width - text_width - padding * 2 - 10
    badge_y = user_height - 35
    
    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [badge_x, badge_y, user_width - 10, user_height - 10],
        radius=5,
        fill=(0, 0, 0, 200)
    )
    draw.text((badge_x + padding, badge_y + 5), badge_text, fill=(212, 173, 117, 255), font=font)
    
    return final.convert('RGB')


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/", response_model=dict)
async def root():
    """Root endpoint."""
    return {
        "service": "Virtual Try-On API",
        "version": "1.0.0",
        "ai_enabled": USE_REPLICATE or USE_FAL or USE_HUGGINGFACE,
        "backends": {
            "fal": USE_FAL,
            "replicate": USE_REPLICATE,
            "huggingface": USE_HUGGINGFACE
        },
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        ai_enabled=USE_REPLICATE or USE_FAL or USE_HUGGINGFACE,
        replicate_configured=bool(REPLICATE_API_TOKEN),
        fal_configured=bool(FAL_API_KEY),
        huggingface_configured=bool(HUGGINGFACE_API_TOKEN)
    )


# ============================================================================
# Image Proxy Endpoint
# ============================================================================

@app.get("/api/proxy/image")
async def proxy_image(url: str = Query(..., description="Image URL to proxy")):
    """
    Proxy endpoint to fetch images from external URLs.
    This bypasses CORS restrictions for the Chrome extension.
    """
    try:
        # Validate URL
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https'):
            raise HTTPException(status_code=400, detail="Invalid URL scheme")
        
        # Fetch image
        image_bytes = await fetch_image_bytes(url)
        
        # Determine content type
        content_type = "image/jpeg"
        if url.lower().endswith('.png'):
            content_type = "image/png"
        elif url.lower().endswith('.webp'):
            content_type = "image/webp"
        elif url.lower().endswith('.gif'):
            content_type = "image/gif"
        
        return Response(
            content=image_bytes,
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",
                "Access-Control-Allow-Origin": "*",
            }
        )
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"Failed to fetch image: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Proxy error: {str(e)}")


@app.get("/api/proxy/image/base64")
async def proxy_image_base64(url: str = Query(..., description="Image URL to proxy")):
    """
    Proxy endpoint that returns image as base64 data URI.
    Useful for directly embedding in canvas or img src.
    """
    try:
        image_bytes = await fetch_image_bytes(url)
        image = Image.open(BytesIO(image_bytes))
        
        # Convert to JPEG for consistent output
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        
        buffer = BytesIO()
        image.save(buffer, format='JPEG', quality=90)
        buffer.seek(0)
        base64_string = base64.b64encode(buffer.getvalue()).decode()
        
        return {
            "success": True,
            "dataUri": f"data:image/jpeg;base64,{base64_string}",
            "width": image.width,
            "height": image.height
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


# ============================================================================
# Try-On Endpoint
# ============================================================================

@app.post("/api/tryon/generate", response_model=TryOnResponse)
async def generate_tryon(request: TryOnRequest):
    """
    Generate a virtual try-on image.
    
    Uses Fal.ai/Replicate AI if configured, otherwise falls back to composite overlay.
    
    fast_mode (default: true):
      - Smaller image sizes (512px vs 768px)
      - Fewer inference steps (20 vs 30)
      - ~40-50% faster generation
    """
    start_time = time.time()
    fast = request.fast_mode
    
    try:
        # Decode user photo
        user_photo = decode_base64_image(request.user_photo)
        user_photo = preprocess_image(user_photo, (768, 1024), fast_mode=fast)
        
        # Get product image (URL or base64)
        if request.product_image.startswith('http'):
            garment_image = await fetch_product_image(request.product_image)
        else:
            garment_image = decode_base64_image(request.product_image)
        
        garment_image = preprocess_image(garment_image, (768, 768), fast_mode=fast)
        
        print(f"[TryOn] Processing with fast_mode={fast}, user_img={user_photo.size}, garment_img={garment_image.size}")
        
        # Try AI generation first, fall back to composite
        method = "composite"
        result_image = None
        
        # Try Hugging Face (Kolors) first - FREE and reliable
        if USE_HUGGINGFACE and result_image is None:
            try:
                print("[TryOn] Attempting Hugging Face (Kolors) AI generation...")
                result_image = await generate_tryon_huggingface(
                    user_photo=user_photo,
                    garment_image=garment_image,
                    garment_type=request.garment_type
                )
                method = "ai-kolors"
                elapsed = time.time() - start_time
                print(f"[TryOn] Hugging Face (Kolors) generation successful! ({elapsed:.1f}s)")
            except Exception as e:
                print(f"[TryOn] Hugging Face failed: {e}")
        
        # Try Fal.ai as second option (fast, paid)
        if USE_FAL and result_image is None:
            try:
                print("[TryOn] Attempting Fal.ai AI generation...")
                result_image = await generate_tryon_fal(
                    user_photo=user_photo,
                    garment_image=garment_image,
                    garment_type=request.garment_type,
                    fast_mode=fast
                )
                method = "ai-fal"
                elapsed = time.time() - start_time
                print(f"[TryOn] Fal.ai generation successful! ({elapsed:.1f}s)")
            except Exception as e:
                print(f"[TryOn] Fal.ai failed: {e}")
        
        # Try Replicate as third option (best quality, paid)
        if USE_REPLICATE and result_image is None:
            try:
                print("[TryOn] Attempting Replicate AI generation...")
                result_image = await generate_tryon_replicate(
                    user_photo=user_photo,
                    garment_image=garment_image,
                    garment_type=request.garment_type
                )
                method = "ai-replicate"
                print("[TryOn] Replicate generation successful!")
            except Exception as e:
                print(f"[TryOn] Replicate failed: {e}")
        
        # Fall back to composite if no AI available
        if result_image is None:
            print("[TryOn] Falling back to composite overlay...")
            result_image = generate_composite_tryon(
                user_photo=user_photo,
                garment_image=garment_image,
                garment_type=request.garment_type
            )
        
        # Encode result
        result_base64 = encode_image_to_base64(result_image)
        processing_time = time.time() - start_time
        
        return TryOnResponse(
            success=True,
            result_image=result_base64,
            processing_time=processing_time,
            method=method
        )
        
    except Exception as e:
        processing_time = time.time() - start_time
        print(f"[TryOn] Error: {e}")
        return TryOnResponse(
            success=False,
            error=str(e),
            processing_time=processing_time
        )


@app.post("/api/body/analyze")
async def analyze_body(user_photo: str = ""):
    """
    Analyze body measurements from photo.
    Placeholder - would use MediaPipe or similar in production.
    """
    try:
        if not user_photo:
            raise ValueError("user_photo is required")
            
        # Placeholder measurements
        return {
            "success": True,
            "measurements": {
                "shoulderWidth": 45,
                "chestWidth": 40,
                "waistWidth": 32,
                "hipWidth": 38,
                "armLength": 60,
                "confidence": 0.75
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/supported-sites")
async def get_supported_sites():
    """Get list of supported e-commerce sites."""
    return {
        "sites": [
            {"domain": "lululemon.com", "name": "Lululemon", "status": "active"},
            {"domain": "amazon.com", "name": "Amazon", "status": "active"},
            {"domain": "asos.com", "name": "ASOS", "status": "active"},
            {"domain": "zara.com", "name": "Zara", "status": "active"},
            {"domain": "hm.com", "name": "H&M", "status": "active"},
            {"domain": "nordstrom.com", "name": "Nordstrom", "status": "active"},
            {"domain": "nike.com", "name": "Nike", "status": "active"},
            {"domain": "adidas.com", "name": "Adidas", "status": "active"},
            {"domain": "gap.com", "name": "Gap", "status": "active"},
            {"domain": "uniqlo.com", "name": "Uniqlo", "status": "active"},
        ]
    }


# ============================================================================
# Error Handlers
# ============================================================================

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc)
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
