import api from './api'
import type { WhatIfRequest, WhatIfResponse } from '@/types'

export const whatIfService = {
  async simulate(data: WhatIfRequest): Promise<WhatIfResponse> {
    const res = await api.post<WhatIfResponse>('/what-if', data)
    return res.data
  },
}
