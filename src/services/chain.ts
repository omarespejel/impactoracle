import { createPublicClient, http, parseAbiItem } from 'viem'
import { baseSepolia } from 'viem/chains'
import { logger } from '../lib/logger'

// ABI for DonationMade event (example - adjust based on your contract)
const DONATION_ABI = [
  parseAbiItem('event DonationMade(address indexed donor, string indexed orgId, uint256 amount)')
] as const

export interface Donation {
  donor: `0x${string}`
  amount: bigint
  orgId: string
}

export class ChainService {
  private client

  constructor(config: { rpcUrl: string }) {
    this.client = createPublicClient({
      chain: baseSepolia,
      transport: http(config.rpcUrl)
    })
  }

  async getDonationFromTx(txHash: `0x${string}`): Promise<Donation> {
    logger.info({ txHash }, 'Fetching donation from transaction')
    
    const receipt = await this.client.getTransactionReceipt({ hash: txHash })
    
    if (!receipt) {
      throw new Error(`Transaction not found: ${txHash}`)
    }

    // Find DonationMade event in logs
    const donationEvent = receipt.logs.find(log => {
      try {
        const decoded = this.client.decodeEventLog({
          abi: DONATION_ABI,
          data: log.data,
          topics: log.topics
        })
        return decoded.eventName === 'DonationMade'
      } catch {
        return false
      }
    })

    if (!donationEvent) {
      throw new Error(`DonationMade event not found in transaction ${txHash}`)
    }

    const decoded = this.client.decodeEventLog({
      abi: DONATION_ABI,
      data: donationEvent.data,
      topics: donationEvent.topics
    })

    return {
      donor: decoded.args.donor,
      amount: decoded.args.amount as bigint,
      orgId: decoded.args.orgId as string
    }
  }
}

