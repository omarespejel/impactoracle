import 'dotenv/config'
import { EigenAIService } from '../src/services/eigenai'

async function main() {
  console.log('🔍 Testing EigenAI connection...\n')

  const service = new EigenAIService({
    apiKey: process.env.EIGENAI_API_KEY!,
    baseUrl: process.env.EIGENAI_BASE_URL || 'https://app.eigenai.com/api/v1',
    model: 'gpt-oss',
    maxTokens: 500
  })

  // Test health
  console.log('1️⃣ Health check...')
  const health = await service.healthCheck()
  console.log('   Status:', health.healthy ? '✅ Healthy' : '❌ Unhealthy')
  if (health.error) console.log('   Error:', health.error)

  // Test report generation
  console.log('\n2️⃣ Generating test impact report...')
  try {
    const report = await service.generateImpactReport({
      txHash: '0x' + 'a'.repeat(64),
      orgId: 'ukraine-medical-aid',
      amount: '1000000', // 1 USDC
      donor: '0x' + 'b'.repeat(40),
      timestamp: Math.floor(Date.now() / 1000)
    })

    console.log('   ✅ Report generated!')
    console.log('   Lives impacted:', report.metrics.livesImpacted)
    console.log('   Resource type:', report.metrics.resourceType)
    console.log('   Confidence:', report.confidence + '%')
    console.log('   Proof:', report.proof.eigenaiProof.slice(0, 20) + '...')
  } catch (error) {
    console.log('   ❌ Failed:', error instanceof Error ? error.message : error)
  }
}

main()

