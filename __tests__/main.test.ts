import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import * as exec from '@actions/exec'
import * as fs from 'fs'

// Mock modules
jest.mock('@actions/core')
jest.mock('@actions/tool-cache')
jest.mock('@actions/exec')
jest.mock('fs')

describe('Setup XC Action', () => {
  let mockCore: jest.Mocked<typeof core>
  let mockTc: jest.Mocked<typeof tc>
  let mockExec: jest.Mocked<typeof exec>
  let mockFs: jest.Mocked<typeof fs>

  beforeEach(() => {
    jest.clearAllMocks()
    mockCore = core as jest.Mocked<typeof core>
    mockTc = tc as jest.Mocked<typeof tc>
    mockExec = exec as jest.Mocked<typeof exec>
    mockFs = fs as jest.Mocked<typeof fs>

    // Default mock implementations
    mockCore.getInput = jest.fn()
    mockCore.info = jest.fn()
    mockCore.setOutput = jest.fn()
    mockCore.setFailed = jest.fn()
    mockCore.addPath = jest.fn()

    mockTc.find = jest.fn()
    mockTc.downloadTool = jest.fn()
    mockTc.cacheDir = jest.fn()

    mockExec.exec = jest.fn()
    mockExec.getExecOutput = jest.fn()

    mockFs.existsSync = jest.fn()
    mockFs.mkdirSync = jest.fn()
  })

  describe('Input Validation', () => {
    test('should validate compiler type', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'invalid'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Invalid compiler type')
      )
    })

    test('should accept valid compiler types', async () => {
      const validCompilers = ['xc8', 'xc16', 'xc32']

      for (const compiler of validCompilers) {
        jest.clearAllMocks()
        mockCore.getInput.mockImplementation((name: string) => {
          if (name === 'compiler') return compiler
          if (name === 'version') return '3.10'
          return '/opt/microchip'
        })

        mockTc.find.mockReturnValue('/cached/path')
        mockFs.existsSync.mockReturnValue(true)

        const { run } = await import('../src/main')
        await run()

        expect(mockCore.setFailed).not.toHaveBeenCalled()
      }
    })
  })

  describe('Download URL Generation', () => {
    test('should generate correct URL for XC8', () => {
      const version = '3.10'
      const expected =
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc8-v3.10-full-install-linux-x64-installer.run'

      // Test URL generation logic
      const url = `https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc8-v${version}-full-install-linux-x64-installer.run`
      expect(url).toBe(expected)
    })

    test('should generate correct URL for XC16', () => {
      const version = '2.10'
      const expected =
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc16-v2.10-full-install-linux64-installer.run'

      const url = `https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc16-v${version}-full-install-linux64-installer.run`
      expect(url).toBe(expected)
    })

    test('should generate correct URL for XC32', () => {
      const version = '5.00'
      const expected =
        'https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc32-v5.00-full-install-linux-x64-installer.run'

      const url = `https://ww1.microchip.com/downloads/aemDocuments/documents/DEV/ProductDocuments/SoftwareTools/xc32-v${version}-full-install-linux-x64-installer.run`
      expect(url).toBe(expected)
    })
  })

  describe('Caching', () => {
    test('should use cached compiler when available', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('/cached/path')

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('from cache'))
      expect(mockTc.downloadTool).not.toHaveBeenCalled()
      expect(mockCore.addPath).toHaveBeenCalledWith('/cached/path/bin')
      expect(mockCore.setOutput).toHaveBeenCalledWith('install-dir', '/cached/path')
      expect(mockCore.setOutput).toHaveBeenCalledWith('compiler-path', '/cached/path/bin')
    })

    test('should cache compiler after installation', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/xc8/v3.10')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockTc.cacheDir).toHaveBeenCalledWith('/opt/microchip/xc8/v3.10', 'xc8', '3.10')
    })
  })

  describe('Prerequisites Installation', () => {
    test('should check for required packages', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)

      // Mock package check - all packages installed
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.info).toHaveBeenCalledWith(
        expect.stringContaining('required 32-bit libraries')
      )
    })

    test('should install missing prerequisites', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)

      // Mock package check - packages not installed
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'not found'
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      // Should call apt-get install
      expect(mockExec.exec).toHaveBeenCalledWith(
        'sudo',
        expect.arrayContaining(['apt-get', 'install']),
        expect.any(Object)
      )
    })
  })

  describe('Installation Process', () => {
    test('should download installer when not cached', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockTc.downloadTool).toHaveBeenCalledWith(
        expect.stringContaining('xc8-v3.10-full-install-linux-x64-installer.run')
      )
    })

    test('should make installer executable', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockExec.exec).toHaveBeenCalledWith('chmod', ['+x', '/tmp/installer.run'])
    })

    test('should run installer with correct arguments', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc32'
        if (name === 'version') return '5.00'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockExec.exec).toHaveBeenCalledWith(
        '/tmp/installer.run',
        ['--mode', 'unattended', '--netservername', 'localhost', '--prefix', expect.any(String)],
        expect.any(Object)
      )
    })

    test('should verify installation directory exists', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockFs.existsSync).toHaveBeenCalled()
    })
  })

  describe('Output Configuration', () => {
    test('should set correct outputs', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc16'
        if (name === 'version') return '2.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('/cached/xc16/v2.10')

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.setOutput).toHaveBeenCalledWith('install-dir', '/cached/xc16/v2.10')
      expect(mockCore.setOutput).toHaveBeenCalledWith('compiler-path', '/cached/xc16/v2.10/bin')
    })

    test('should add compiler to PATH', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc32'
        if (name === 'version') return '5.00'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('/cached/xc32/v5.00')

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.addPath).toHaveBeenCalledWith('/cached/xc32/v5.00/bin')
    })
  })

  describe('Error Handling', () => {
    test('should handle download failures', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockRejectedValue(new Error('Download failed'))
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download installer')
      )
    })

    test('should handle installation failures', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockFs.existsSync.mockReturnValue(false)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockRejectedValue(new Error('Installation failed'))

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Installation failed')
      )
    })

    test('should handle missing bin directory after installation', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        return '/opt/microchip'
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockFs.existsSync.mockReturnValue(false)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('Installation verification failed')
      )
    })
  })

  describe('Custom Installation Directory', () => {
    test('should use custom installation directory', async () => {
      const customDir = '/custom/install/path'

      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'compiler') return 'xc8'
        if (name === 'version') return '3.10'
        if (name === 'install-dir') return customDir
        return ''
      })

      mockTc.find.mockReturnValue('')
      mockTc.downloadTool.mockResolvedValue('/tmp/installer.run')
      mockTc.cacheDir.mockResolvedValue('/cached/path')
      mockFs.existsSync.mockReturnValue(true)
      mockExec.getExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii package',
        stderr: ''
      })
      mockExec.exec.mockResolvedValue(0)

      const { run } = await import('../src/main')
      await run()

      expect(mockExec.exec).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--prefix', expect.stringContaining(customDir)]),
        expect.any(Object)
      )
    })
  })
})
