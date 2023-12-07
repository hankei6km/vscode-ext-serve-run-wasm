import { Wasm, Stdio, ProcessOptions, WasmProcess } from '@vscode/wasm-wasi'
import { Readable as NodeReadable, Writable as NodeWritable } from 'node:stream'
import type { Uri } from 'vscode'
import { IpcHandler, getWasmBits } from './ipcServer'
import { ArgsForRun, memoryDescriptor } from './args'
import { getOutputHandler } from './stdio'

type PayloadRun = {
  cwd?: Uri
  args: ArgsForRun
  pipeIn?: NodeReadable
  pipeOut?: NodeWritable
  pipeErr?: NodeWritable
  pipeStatus?: NodeWritable
}

export class HandleRun implements IpcHandler {
  private wasm: Wasm
  constructor(wasm: Wasm) {
    this.wasm = wasm
  }
  async handle(request: PayloadRun): Promise<any> {
    let exitStatus: number = 1 // エラーに設定しておく(成功すれば 0 に上書きされる)
    let process: WasmProcess | undefined
    // run wasm
    //const pty = wasm.createPseudoterminal()
    //const terminal = window.createTerminal({
    //  name,
    //  pty,
    //  isTransient: true
    //})
    //terminal.show(true)
    //const pipeIn = wasm.createWritable()
    // pty の扱いどうする？
    // (そもそも wasi で pty ってどうなってるの？)
    const handleToOut = getOutputHandler('out', request.pipeOut)
    const handleToErr = getOutputHandler('err', request.pipeErr)
    const stdio: Stdio = {
      in: { kind: 'pipeIn' },
      out: { kind: 'pipeOut' },
      err: { kind: 'pipeOut' }
    }
    const options: ProcessOptions = {
      stdio,
      // /workspace のみがされたマウントされた状態になっている
      // オプションなどで任意のディレクトリをマウントすることも考える？
      mountPoints: [{ kind: 'workspaceFolder' }],
      args: request.args.cmdArgs,
      trace: true
    }
    try {
      if (request.cwd === undefined) {
        throw new Error('cwd is undefined')
      }
      const wasmBits = await getWasmBits(request.cwd, request.args.cmdPath)
      const module = await WebAssembly.compile(wasmBits)
      const memory = memoryDescriptor(request.args.runArgs)

      if (memory !== undefined) {
        process = await this.wasm.createProcess(
          request.args.cmdName,
          module,
          memory,
          options
        )
      } else {
        process = await this.wasm.createProcess(
          request.args.cmdName,
          module,
          options
        )
      }
      if (
        typeof request.args.runArgs[
          'force-exit-after-n-seconds-stdin-is-closed'
        ] === 'number' &&
        request.args.runArgs['force-exit-after-n-seconds-stdin-is-closed'] > 0
      ) {
        ;(async () => {
          // https://github.com/microsoft/vscode-wasm/issues/110
          // 大きいデータを write すると不安定になる.
          // https://github.com/microsoft/vscode-wasm/issues/143
          // この辺の暫定的な対応にしたかったが stdin を終了させる方法は実装されていななさそう
          // end() は定義されているが空の関数.
          if (process?.stdin !== undefined) {
            const chunkSize = 4096 // It worked fine up to 8096 as far as I tested.
            for await (const data of request.pipeIn!) {
              // await will not complete when the number of write operations or data volume increases.
              // Divide the data into chunks of size chunkSize and write them.
              for (let i = 0; i < data.length; i += chunkSize) {
                const chunk = data.slice(i, i + chunkSize)
                await process.stdin?.write(chunk)
                // Wait for the chunk to be consumed because holding too many chunks can cause instability
                // "process.stdin.chunks" is undocumented, so it may change in the future.
                while ((process.stdin as any).chunks.length > 0) {
                  await new Promise((resolve) => setTimeout(resolve, 100))
                }
              }
              if (process === undefined) break
            }
            await new Promise((resolve) =>
              setTimeout(
                resolve,
                1000 *
                  request.args.runArgs[
                    'force-exit-after-n-seconds-stdin-is-closed'
                  ]
              )
            )
            process.terminate()
          }
        })()
      }
      process?.stdout?.onData(handleToOut)
      process?.stderr?.onData(handleToErr)
      const started = Date.now()
      exitStatus = await process.run()

      // stdout and stderr data is not completely consumed even after "process.run()" completes.
      // "process.stdin.chunks" is undocumented, so it may change in the future.
      if (process?.stdout != undefined && process?.stderr != undefined) {
        while (
          (process.stdout as any).chunks.length > 0 ||
          (process.stderr as any).chunks.length > 0
        ) {
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
      }
      if (request.args.runArgs['print-elapsed-time']) {
        handleToOut(Array.from(Buffer.from(`${Date.now() - started}\n`)))
      }
      // TODO: pipe 用のストリームを開放(おそらく開放されない)
    } catch (err: any) {
      handleToErr(Array.from(Buffer.from(`run: ${err.toString()}\n`)))
    }
    return { kind: 'status', data: [exitStatus] }
  }
}
