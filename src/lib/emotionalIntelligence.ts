// ── Emotional Intelligence Engine ────────────────────────────────────────────
// Analyzes prospect speech patterns from transcript and generates
// real-time mirroring instructions for the AI voice agent.

export interface EmotionalProfile {
  detected_emotion: 'excited' | 'skeptical' | 'busy' | 'friendly' | 'guarded' | 'curious' | 'frustrated' | 'neutral' | 'interested'
  energy_level: 'high' | 'medium' | 'low'
  speaking_pace: 'fast' | 'normal' | 'slow'
  formality: 'formal' | 'casual' | 'mixed'
  engagement: 'increasing' | 'stable' | 'decreasing'
  trust_level: number
  openness_score: number
  buying_readiness: number
  voice_characteristics: {
    estimated_age_range: string
    gender_inference: string
    regional_markers: string[]
    vocabulary_level: 'simple' | 'average' | 'sophisticated'
  }
  mirror_instructions: {
    pace: string
    energy: string
    formality: string
    vocabulary: string[]
    avoid: string[]
    use_humor: boolean
    use_empathy_phrases: boolean
    recommended_tone: string
  }
}

export function analyzeEmotionalProfile(transcript: string): EmotionalProfile {
  const text = transcript.toLowerCase()
  const words = text.split(/\s+/)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5)

  const exclamations = (transcript.match(/!/g) || []).length
  const shortResponses = sentences.filter(s => s.split(' ').length < 4).length
  const longResponses = sentences.filter(s => s.split(' ').length > 15).length

  let energyLevel: 'high' | 'medium' | 'low' = 'medium'
  if (exclamations > 3 || longResponses > shortResponses * 2) energyLevel = 'high'
  if (shortResponses > longResponses * 2) energyLevel = 'low'

  let emotion: EmotionalProfile['detected_emotion'] = 'neutral'
  if (text.includes('great') || text.includes('love') || text.includes('excited') || text.includes('amazing')) emotion = 'excited'
  else if (text.includes('busy') || text.includes("don't have time") || text.includes('quick')) emotion = 'busy'
  else if (text.includes('interesting') || text.includes('tell me') || text.includes('curious')) emotion = 'curious'
  else if (text.includes('not sure') || text.includes('doubt') || text.includes('skeptical') || text.includes("don't know")) emotion = 'skeptical'
  else if (text.includes('frustrated') || text.includes('annoyed') || text.includes('waste')) emotion = 'frustrated'
  else if (text.includes('yeah') || text.includes('sure') || text.includes('okay') || text.includes('go ahead')) emotion = 'friendly'
  else if (text.includes('interested') || text.includes('sounds good') || text.includes('more info')) emotion = 'interested'
  else if (text.includes("don't") || text.includes('not interested') || text.includes('already')) emotion = 'guarded'

  const casualMarkers = ['yeah', 'gonna', 'wanna', 'kinda', 'sorta', 'ya', 'nah', 'yep', 'nope', "ain't"]
  const formalMarkers = ['certainly', 'indeed', 'however', 'therefore', 'regarding', 'concerning', 'furthermore']
  const casualCount = casualMarkers.filter(m => text.includes(m)).length
  const formalCount = formalMarkers.filter(m => text.includes(m)).length
  const formality: 'formal' | 'casual' | 'mixed' =
    formalCount > casualCount * 2 ? 'formal' :
    casualCount > formalCount * 2 ? 'casual' : 'mixed'

  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1)
  const speakingPace: 'fast' | 'normal' | 'slow' =
    avgWordsPerSentence > 20 ? 'fast' :
    avgWordsPerSentence < 8 ? 'slow' : 'normal'

  const sophisticatedWords = ['leverage', 'optimize', 'scalable', 'synergy', 'roi', 'metrics', 'infrastructure', 'implement', 'strategic', 'allocate']
  const sophisticatedCount = sophisticatedWords.filter(w => text.includes(w)).length
  const vocabLevel: 'simple' | 'average' | 'sophisticated' =
    sophisticatedCount > 3 ? 'sophisticated' :
    sophisticatedCount > 1 ? 'average' : 'simple'

  let trust = 40
  if (emotion === 'friendly') trust += 25
  if (emotion === 'curious' || emotion === 'interested') trust += 20
  if (emotion === 'skeptical' || emotion === 'guarded') trust -= 15
  if (emotion === 'frustrated') trust -= 25
  if (longResponses > 3) trust += 15
  trust = Math.max(0, Math.min(100, trust))

  let openness = 50
  if (longResponses > shortResponses) openness += 20
  if (emotion === 'excited' || emotion === 'friendly') openness += 20
  if (emotion === 'guarded' || emotion === 'busy') openness -= 20
  openness = Math.max(0, Math.min(100, openness))

  let buyingReadiness = 30
  if (emotion === 'interested') buyingReadiness += 30
  if (emotion === 'curious') buyingReadiness += 20
  if (emotion === 'excited') buyingReadiness += 25
  if (emotion === 'skeptical') buyingReadiness -= 10
  if (emotion === 'guarded') buyingReadiness -= 15
  buyingReadiness = Math.max(0, Math.min(100, buyingReadiness))

  const mirrorInstructions = buildMirrorInstructions(emotion, energyLevel, formality, speakingPace, vocabLevel)

  return {
    detected_emotion: emotion,
    energy_level: energyLevel,
    speaking_pace: speakingPace,
    formality,
    engagement: longResponses > shortResponses ? 'increasing' : shortResponses > longResponses ? 'decreasing' : 'stable',
    trust_level: trust,
    openness_score: openness,
    buying_readiness: buyingReadiness,
    voice_characteristics: {
      estimated_age_range: estimateAgeRange(text),
      gender_inference: 'not determined',
      regional_markers: detectRegionalMarkers(text),
      vocabulary_level: vocabLevel,
    },
    mirror_instructions: mirrorInstructions,
  }
}

function buildMirrorInstructions(
  emotion: string,
  energy: string,
  formality: string,
  pace: string,
  vocab: string
): EmotionalProfile['mirror_instructions'] {
  return {
    pace: pace === 'fast' ? 'Match their pace — speak slightly faster, be crisp and direct' :
          pace === 'slow' ? 'Slow down — be deliberate, pause more, let silence work for you' :
          'Normal conversational pace',
    energy: energy === 'high' ? 'Match their high energy — be enthusiastic and engaged' :
            energy === 'low' ? 'Lower your energy — be calm, measured, dont push' :
            'Moderate energy — warm and professional',
    formality: formality === 'formal' ? 'Use formal language — avoid contractions, be precise' :
               formality === 'casual' ? 'Be casual — use their language, match their relaxed tone' :
               'Balance professional and approachable',
    vocabulary: vocab === 'sophisticated' ?
      ['leverage', 'optimize', 'ROI', 'metrics', 'strategic', 'scalable'] :
      vocab === 'simple' ?
      ['get more customers', 'make more money', 'save time', 'grow your business'] :
      ['results', 'leads', 'growth', 'customers', 'revenue'],
    avoid: emotion === 'busy' ? ['long explanations', 'complex questions', 'multiple asks'] :
           emotion === 'skeptical' ? ['big promises', 'hype words', 'pressure tactics'] :
           emotion === 'frustrated' ? ['dismissing their concerns', 'moving too fast'] :
           [],
    use_humor: formality === 'casual' && (emotion === 'friendly' || energy === 'high'),
    use_empathy_phrases: emotion === 'frustrated' || emotion === 'skeptical' || emotion === 'guarded',
    recommended_tone: emotion === 'excited' ? 'Match excitement, channel into the meeting' :
                     emotion === 'skeptical' ? 'Confident but humble, lead with proof not promises' :
                     emotion === 'busy' ? 'Ultra brief, respect their time, value proposition in 10 words' :
                     emotion === 'curious' ? 'Feed their curiosity, tease value, ask questions back' :
                     emotion === 'frustrated' ? 'Acknowledge first, then redirect, never dismiss' :
                     emotion === 'guarded' ? 'Low pressure, peer-to-peer, no sales language' :
                     'Warm, professional, curious about their business',
  }
}

function estimateAgeRange(text: string): string {
  if (text.includes('back in the day') || text.includes('years ago') || text.includes('retirement')) return '50+'
  if (text.includes('startup') || text.includes('hustle') || text.includes('grind') || text.includes('crushing it')) return '25-35'
  if (text.includes('my kids') || text.includes('mortgage') || text.includes('established')) return '35-50'
  return 'Unknown'
}

function detectRegionalMarkers(text: string): string[] {
  const markers: string[] = []
  if (text.includes("y'all") || text.includes('fixin to')) markers.push('Southern US')
  if (text.includes('wicked') || text.includes('pissah')) markers.push('New England')
  if (text.includes('youse') || text.includes('jawn')) markers.push('Northeast')
  if (text.includes('hella') || text.includes('stoked')) markers.push('West Coast')
  return markers
}

export function generateMirrorInstruction(
  currentEmotion: EmotionalProfile,
  callPhase: 'opening' | 'qualification' | 'objection' | 'closing',
  _lastProspectStatement: string
): string {
  const { mirror_instructions, trust_level, buying_readiness } = currentEmotion

  let instruction = `MIRROR: ${mirror_instructions.recommended_tone}. `
  instruction += `PACE: ${mirror_instructions.pace}. `

  if (mirror_instructions.use_empathy_phrases) {
    instruction += `USE EMPATHY: Start with "I completely understand..." or "That makes total sense...". `
  }

  if (mirror_instructions.use_humor && callPhase !== 'closing') {
    instruction += `LIGHT HUMOR OK. `
  }

  if (mirror_instructions.avoid.length > 0) {
    instruction += `AVOID: ${mirror_instructions.avoid.join(', ')}. `
  }

  instruction += `VOCABULARY: Use words like "${mirror_instructions.vocabulary.slice(0, 3).join('", "')}". `

  if (trust_level < 40) {
    instruction += `TRUST IS LOW — slow down, ask questions, dont push. `
  }

  if (buying_readiness > 70) {
    instruction += `HIGH BUYING READINESS — move toward the ask now. `
  }

  return instruction
}

export function updateEmotionalState(
  previousProfile: EmotionalProfile | null,
  newTranscriptSegment: string,
  _callPhasePercent: number
): EmotionalProfile {
  const newProfile = analyzeEmotionalProfile(newTranscriptSegment)

  if (!previousProfile) return newProfile

  return {
    ...newProfile,
    trust_level: Math.round((previousProfile.trust_level * 0.4) + (newProfile.trust_level * 0.6)),
    openness_score: Math.round((previousProfile.openness_score * 0.4) + (newProfile.openness_score * 0.6)),
    buying_readiness: Math.round((previousProfile.buying_readiness * 0.3) + (newProfile.buying_readiness * 0.7)),
    engagement: newProfile.trust_level > previousProfile.trust_level ? 'increasing' :
                newProfile.trust_level < previousProfile.trust_level ? 'decreasing' : 'stable',
  }
}
