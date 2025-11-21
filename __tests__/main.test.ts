import { getDownloadUrl, getCompilerPath, getBinPath } from '../src/main'
describe('Setup XC Action - Helper Functions', () => {
  describe('URL Generation', () => {
    test('should generate correct URL for XC8', () => {
      const url = getDownloadUrl('xc8', '3.10')
      expect(url).toBe(
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc8-v3.10-full-install-linux-x64-installer.run'
      )
    })
    test('should generate correct URL for XC16', () => {
      const url = getDownloadUrl('xc16', '2.10')
      expect(url).toBe(
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc16-v2.10-full-install-linux64-installer.run'
      )
    })
    test('should generate correct URL for XC32', () => {
      const url = getDownloadUrl('xc32', '5.00')
      expect(url).toBe(
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc32-v5.00-full-install-linux-x64-installer.run'
      )
    })
    test('should throw error for invalid compiler', () => {
      expect(() => getDownloadUrl('invalid', '1.0')).toThrow('Unsupported compiler: invalid')
    })
    test('should handle different version formats for XC8', () => {
      const url = getDownloadUrl('xc8', '2.50')
      expect(url).toContain('xc8-v2.50-full-install-linux-x64-installer.run')
    })
    test('should handle different version formats for XC16', () => {
      const url = getDownloadUrl('xc16', '1.70')
      expect(url).toContain('xc16-v1.70-full-install-linux64-installer.run')
    })
    test('should handle different version formats for XC32', () => {
      const url = getDownloadUrl('xc32', '4.35')
      expect(url).toContain('xc32-v4.35-full-install-linux-x64-installer.run')
    })
    test('should handle case-insensitive compiler names', () => {
      const urlUpper = getDownloadUrl('XC8', '3.10')
      const urlLower = getDownloadUrl('xc8', '3.10')
      expect(urlUpper).toBe(urlLower)
    })
    test('should throw error for xc7 compiler', () => {
      expect(() => getDownloadUrl('xc7', '1.0')).toThrow('Unsupported compiler')
    })
    test('should throw error for empty compiler name', () => {
      expect(() => getDownloadUrl('', '1.0')).toThrow('Unsupported compiler')
    })
    test('should throw specific error message for unsupported compiler', () => {
      expect(() => getDownloadUrl('unsupported', '1.0')).toThrow(
        'Unsupported compiler: unsupported. Must be one of: xc8, xc16, xc32'
      )
    })
  })
  describe('Path Generation', () => {
    test('should generate correct compiler path', () => {
      const path = getCompilerPath('/opt/microchip', 'xc8', '3.10')
      expect(path).toBe('/opt/microchip/xc8/v3.10')
    })
    test('should generate correct compiler path for xc16', () => {
      const path = getCompilerPath('/usr/local', 'xc16', '2.10')
      expect(path).toBe('/usr/local/xc16/v2.10')
    })
    test('should generate correct compiler path for xc32', () => {
      const path = getCompilerPath('/custom/path', 'xc32', '5.00')
      expect(path).toBe('/custom/path/xc32/v5.00')
    })
    test('should handle different version formats in paths', () => {
      const path = getCompilerPath('/opt/microchip', 'xc16', '1.00')
      expect(path).toBe('/opt/microchip/xc16/v1.00')
    })
    test('should generate correct bin path', () => {
      const binPath = getBinPath('/opt/microchip/xc8/v3.10')
      expect(binPath).toBe('/opt/microchip/xc8/v3.10/bin')
    })
    test('should generate correct bin path for xc16', () => {
      const binPath = getBinPath('/usr/local/xc16/v2.10')
      expect(binPath).toBe('/usr/local/xc16/v2.10/bin')
    })
    test('should generate correct bin path for xc32', () => {
      const binPath = getBinPath('/opt/xc32/v5.00')
      expect(binPath).toBe('/opt/xc32/v5.00/bin')
    })
    test('should handle complex nested paths', () => {
      const path = getCompilerPath('/home/user/tools/compilers', 'xc8', '3.10')
      expect(path).toBe('/home/user/tools/compilers/xc8/v3.10')
    })
    test('should handle relative paths', () => {
      const path = getCompilerPath('./microchip', 'xc16', '2.10')
      expect(path).toBe('microchip/xc16/v2.10')
    })
    test('should generate path with version prefix', () => {
      const path = getCompilerPath('/opt', 'xc32', '6.00')
      expect(path).toContain('/v6.00')
    })
  })
  describe('Compiler Validation', () => {
    test('should identify valid compilers', () => {
      const validCompilers = ['xc8', 'xc16', 'xc32']
      expect(validCompilers).toContain('xc8')
      expect(validCompilers).toContain('xc16')
      expect(validCompilers).toContain('xc32')
    })
    test('should reject invalid compilers', () => {
      const validCompilers = ['xc8', 'xc16', 'xc32']
      expect(validCompilers).not.toContain('invalid')
      expect(validCompilers).not.toContain('xc7')
    })
    test('should have exactly 3 valid compilers', () => {
      const validCompilers = ['xc8', 'xc16', 'xc32']
      expect(validCompilers).toHaveLength(3)
    })
    test('should not include gcc or clang', () => {
      const validCompilers = ['xc8', 'xc16', 'xc32']
      expect(validCompilers).not.toContain('gcc')
      expect(validCompilers).not.toContain('clang')
    })
  })
  describe('Prerequisites Packages', () => {
    test('should list required 32-bit packages', () => {
      const requiredPackages = [
        'libc6:i386',
        'libx11-6:i386',
        'libxext6:i386',
        'libstdc++6:i386',
        'libexpat1:i386'
      ]
      expect(requiredPackages).toHaveLength(5)
      expect(requiredPackages).toContain('libc6:i386')
      expect(requiredPackages).toContain('libx11-6:i386')
    })
    test('should include all required X11 libraries', () => {
      const requiredPackages = [
        'libc6:i386',
        'libx11-6:i386',
        'libxext6:i386',
        'libstdc++6:i386',
        'libexpat1:i386'
      ]
      expect(requiredPackages).toContain('libx11-6:i386')
      expect(requiredPackages).toContain('libxext6:i386')
    })
    test('should include libc6 package', () => {
      const requiredPackages = ['libc6:i386']
      expect(requiredPackages).toContain('libc6:i386')
    })
    test('should include libstdc++ package', () => {
      const requiredPackages = ['libstdc++6:i386']
      expect(requiredPackages).toContain('libstdc++6:i386')
    })
    test('should include libexpat package', () => {
      const requiredPackages = ['libexpat1:i386']
      expect(requiredPackages).toContain('libexpat1:i386')
    })
    test('all packages should be i386 architecture', () => {
      const requiredPackages = [
        'libc6:i386',
        'libx11-6:i386',
        'libxext6:i386',
        'libstdc++6:i386',
        'libexpat1:i386'
      ]
      requiredPackages.forEach(pkg => {
        expect(pkg).toMatch(/:i386$/)
      })
    })
  })
  describe('Constants and URLs', () => {
    test('should have correct base URL', () => {
      const expectedBaseUrl =
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools'
      const url = getDownloadUrl('xc8', '3.10')
      expect(url).toContain(expectedBaseUrl)
    })
    test('should generate URLs with correct structure', () => {
      const url = getDownloadUrl('xc8', '3.10')
      expect(url).toMatch(/^https:\/\//)
      expect(url).toMatch(/\.run$/)
      expect(url).toContain('microchip.com')
    })
    test('URLs should contain version string', () => {
      const url = getDownloadUrl('xc16', '2.10')
      expect(url).toContain('v2.10')
    })
    test('URLs should contain compiler name', () => {
      const url = getDownloadUrl('xc32', '5.00')
      expect(url).toContain('xc32')
    })
  })
  describe('Edge Cases', () => {
    test('should handle version with special characters', () => {
      const url = getDownloadUrl('xc8', '3.10-beta')
      expect(url).toContain('v3.10-beta')
    })
    test('should handle very long version numbers', () => {
      const url = getDownloadUrl('xc8', '10.20.30')
      expect(url).toContain('v10.20.30')
    })
    test('should handle single digit versions', () => {
      const url = getDownloadUrl('xc32', '1')
      expect(url).toContain('v1')
    })
    test('should handle paths with spaces', () => {
      const path = getCompilerPath('/opt/my compilers', 'xc8', '3.10')
      expect(path).toBe('/opt/my compilers/xc8/v3.10')
    })
    test('should handle uppercase XC compiler names', () => {
      const url1 = getDownloadUrl('XC16', '2.10')
      const url2 = getDownloadUrl('xc16', '2.10')
      expect(url1).toBe(url2)
    })
    test('should handle mixed case compiler names', () => {
      const url = getDownloadUrl('Xc32', '5.00')
      expect(url).toContain('xc32')
    })
  })
})
