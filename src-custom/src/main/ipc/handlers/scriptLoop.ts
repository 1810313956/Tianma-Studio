import { application } from '@application'
import type { scriptLoopRequestSchemas } from '@shared/ipc/schemas/scriptLoop'
import type { IpcHandlersFor } from '@shared/ipc/types'

export const scriptLoopHandlers: IpcHandlersFor<typeof scriptLoopRequestSchemas> = {
  'scriptLoop.start': async (input) => application.get('ScriptLoopService').start(input),
  'scriptLoop.current': async () => application.get('ScriptLoopService').current()
}
