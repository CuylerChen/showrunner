export type ActionType = 'navigate' | 'click' | 'fill' | 'wait' | 'assert'

export type StepStatus = 'pending' | 'recording' | 'completed' | 'failed' | 'skipped'

export interface Step {
  id: string
  position: number
  title: string
  action_type: ActionType
  selector: string | null
  value: string | null
  narration: string | null
  timestamp_start?: number
  timestamp_end?: number
}

export interface RecordResult {
  videoPath: string          // 录制输出的 .webm 文件路径
  stepTimestamps: Array<{    // 每个步骤在视频中的时间节点
    stepId: string
    start: number
    end: number
  }>
}

export interface TtsResult {
  audioPaths: string[]       // 每个步骤对应的音频文件路径（顺序与 steps 一致）
  totalDuration: number      // 旁白总时长（秒）
}

export interface MergeResult {
  outputPath: string         // 最终 .mp4 文件路径
  duration: number           // 视频总时长（秒）
}
