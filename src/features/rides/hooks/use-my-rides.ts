'use client'

import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query'
import { ridesApi } from '../api/rides.api'

export function useMyRides() {
  return useQuery({
    queryKey: queryKeys.rides.mine(),
    queryFn: () => ridesApi.listMine(),
  })
}
