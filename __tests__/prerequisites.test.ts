import * as exec from '@actions/exec'
import * as core from '@actions/core'
import { isPackageInstalled, installPrerequisites } from '../src/main'
// Mock the dependencies
vi.mock('@actions/exec')
vi.mock('@actions/core')
describe('Prerequisites Installation', () => {
  describe('isPackageInstalled', () => {
    it('should return true when package is installed', async () => {
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 0,
        stdout: 'ii  libc6:i386  2.31-0ubuntu9',
        stderr: ''
      })
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(true)
      expect(vi.mocked(exec.getExecOutput)).toHaveBeenCalledWith('dpkg', ['-l', 'libc6:i386'], {
        silent: true,
        ignoreReturnCode: true
      })
    })
    it('should return false when package is not installed', async () => {
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 1,
        stdout: 'dpkg-query: no packages found matching',
        stderr: ''
      })
      const result = await isPackageInstalled('nonexistent:i386')
      expect(result).toBe(false)
    })
    it('should return false when exitCode is 0 but package state is not "ii"', async () => {
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 0,
        stdout: 'rc  libc6:i386  (removed)',
        stderr: ''
      })
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(false)
    })
    it('should return false on error', async () => {
      vi.mocked(exec.getExecOutput).mockRejectedValue(new Error('Command failed'))
      const result = await isPackageInstalled('libc6:i386')
      expect(result).toBe(false)
    })
  })
  describe('installPrerequisites', () => {
    it('should skip installation when all packages are already installed', async () => {
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 0,
        stdout: 'ii  package',
        stderr: ''
      })
      await installPrerequisites()
      expect(vi.mocked(core.info)).toHaveBeenCalledWith('Checking for required 32-bit libraries...')
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        '✅ All required packages are already installed'
      )
      expect(vi.mocked(exec.exec)).not.toHaveBeenCalled()
    })
    it('should install missing packages', async () => {
      // First package not installed, rest installed
      vi.mocked(exec.getExecOutput)
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
      vi.mocked(exec.exec).mockResolvedValue(0)
      await installPrerequisites()
      expect(vi.mocked(core.info)).toHaveBeenCalledWith('Checking for required 32-bit libraries...')
      expect(vi.mocked(core.info)).toHaveBeenCalledWith(
        expect.stringContaining('Installing missing packages:')
      )
      expect(vi.mocked(exec.exec)).toHaveBeenCalledWith(
        'sudo',
        ['dpkg', '--add-architecture', 'i386'],
        {
          silent: true
        }
      )
      expect(vi.mocked(exec.exec)).toHaveBeenCalledWith('sudo', ['apt-get', 'update', '-qq'], {
        silent: true
      })
      expect(vi.mocked(exec.exec)).toHaveBeenCalledWith(
        'sudo',
        expect.arrayContaining(['apt-get', 'install', '-y', '-qq']),
        { silent: true }
      )
    })
    it('should throw error when installation fails', async () => {
      // All packages missing
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 1,
        stdout: 'not found',
        stderr: ''
      })
      vi.mocked(exec.exec).mockRejectedValue(new Error('apt-get failed'))
      await expect(installPrerequisites()).rejects.toThrow('Failed to install prerequisites')
    })
    it('should install multiple missing packages', async () => {
      // All packages missing
      vi.mocked(exec.getExecOutput).mockResolvedValue({
        exitCode: 1,
        stdout: 'not found',
        stderr: ''
      })
      vi.mocked(exec.exec).mockResolvedValue(0)
      await installPrerequisites()
      const installCall = vi
        .mocked(exec.exec)
        .mock.calls.find(call => Array.isArray(call[1]) && call[1].includes('install'))
      expect(installCall).toBeDefined()
      const args = installCall![1] as string[]
      expect(args).toContain('libc6:i386')
      expect(args).toContain('libx11-6:i386')
    })
  })
})
