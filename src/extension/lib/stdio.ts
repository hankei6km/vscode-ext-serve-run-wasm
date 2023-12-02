import { Writable as NodeWritable } from 'node:stream'
export type RespRunOut = {
  kind: 'out'
  data: string
}

export type RespRunErr = {
  kind: 'err'
  data: number[]
}

export type RespStatus = {
  kind: 'status'
  code: number[]
}

export function getOutputHandler(
  kind: 'out' | 'err',
  pipe?: NodeWritable
): (data: Uint8Array | number[]) => void {
  if (pipe === undefined) {
    return (_data: Uint8Array | number[]) => {}
  }
  return (data: Uint8Array | number[]) => {
    pipe.write(`${JSON.stringify({ kind, data: Array.from(data) })}\n`)
  }
}
