import * as exec from '@actions/exec'
import * as core from '@actions/core'
import { isPackageInstalled, installPrerequisites } from '../src/main'
// Mock the dependencies
jest.mock('@actions/exec')
jest.mock('@actions/core')
describe('Prerequisites Installation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })
  describe('isPackageInstalled', () => {
    it('should return true when package is installed', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      mockGetExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii  libc6:i386  2.31-0ubuntu9',
        stderr: ''
      })
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(true)
      expect(mockGetExecOutput).toHaveBeenCalledWith('dpkg', ['-l', 'libc6:i386'], {
        silent: true,
        ignoreReturnCode: true
      })
    })
    it('should return false when package is not installed', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      mockGetExecOutput.mockResolvedValue({
        exitCode: 1,
        stdout: 'dpkg-query: no packages found matching',
        stderr: ''
      })
      const result = await isPackageInstalled('nonexistent:i386')
      expect(result).toBe(false)
    })
    it('should return false when exitCode is 0 but package state is not "ii"', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      mockGetExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'rc  libc6:i386  (removed)',
        stderr: ''
      })
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(false)
    })
    it('should return false on error', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      mockGetExecOutput.mockRejectedValue(new Error('Command failed'))
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(false)
    })
  })
  describe('installPrerequisites', () => {
    it('should skip installation when all packages are already installed', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
      const mockInfo = core.info as jest.MockedFunction<typeof core.info>
      mockGetExecOutput.mockResolvedValue({
        exitCode: 0,
        stdout: 'ii  package',
        stderr: ''
      })
      await installPrerequisites()
      expect(mockInfo).toHaveBeenCalledWith('Checking for required 32-bit libraries...')
      expect(mockInfo).toHaveBeenCalledWith('✅ All required packages are already installed')
      expect(mockExec).not.toHaveBeenCalled()
    })
    it('should install missing packages', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
      const mockInfo = core.info as jest.MockedFunction<typeof core.info>
      // First package not installed, rest installed
      mockGetExecOutput
        .mockResolvedValueOnce({
          exitCode: 1,
          stdout: 'not found',
          stderr: ''
        })
        .mockResolvedValue({
          exitCode: 0,
          stdout: 'ii  package',
          stderr: ''
        })
      mockExec.mockResolvedValue(0)
      await installPrerequisites()
      expect(mockInfo).toHaveBeenCalledWith('Checking for required 32-bit libraries...')
      expect(mockInfo).toHaveBeenCalledWith(expect.stringContaining('Installing missing packages:'))
      expect(mockExec).toHaveBeenCalledWith('sudo', ['dpkg', '--add-architecture', 'i386'], {
        silent: true
      })
      expect(mockExec).toHaveBeenCalledWith('sudo', ['apt-get', 'update', '-qq'], {
        silent: true
      })
      expect(mockExec).toHaveBeenCalledWith(
        'sudo',
        expect.arrayContaining(['apt-get', 'install', '-y', '-qq']),
        { silent: false }
      )
    })
    it('should throw error when installation fails', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
      // All packages missing
      mockGetExecOutput.mockResolvedValue({
        exitCode: 1,
        stdout: 'not found',
        stderr: ''
      })
      mockExec.mockRejectedValue(new Error('apt-get failed'))
      await expect(installPrerequisites()).rejects.toThrow('Failed to install prerequisites')
    })
    it('should install multiple missing packages', async () => {
      const mockGetExecOutput = exec.getExecOutput as jest.MockedFunction<typeof exec.getExecOutput>
      const mockExec = exec.exec as jest.MockedFunction<typeof exec.exec>
      // All packages missing
      mockGetExecOutput.mockResolvedValue({
        exitCode: 1,
        stdout: 'not found',
        stderr: ''
      })
      mockExec.mockResolvedValue(0)
      await installPrerequisites()
      const installCall = mockExec.mock.calls.find(
        call => Array.isArray(call[1]) && call[1].includes('install')
      )
      expect(installCall).toBeDefined()
      const args = installCall![1] as string[]
      expect(args).toContain('libc6:i386')
      expect(args).toContain('libx11-6:i386')
    })
  })
})
