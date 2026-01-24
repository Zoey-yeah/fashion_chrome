function IndexPopup() {
  return (
    <div style={{ 
      width: 380, 
      height: 580, 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#1a1b1d',
      color: '#f6f6f7',
      fontFamily: 'system-ui'
    }}>
      <div style={{ textAlign: 'center', padding: 20 }}>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>👗 Virtual Try-On</h1>
        <p style={{ color: '#9fa2aa' }}>Chrome Extension is working!</p>
      </div>
    </div>
  )
}

export default IndexPopup
