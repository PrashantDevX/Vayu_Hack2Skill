import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Bot, Send, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PageHeading } from '../components/PageHeading'
import { SourceLinks } from '../components/SourceLinks'
import { askVayu } from '../services/chatService'
import { pollutantValue } from '../utils/aqi'
import type { ChatMessage, Profile } from '../types'

/**
 * Suggested questions are derived from today's reading and the saved household,
 * not from a fixed list. Every string is also routed by `classifyChatIntent`, so
 * a one-tap question always has a real answer — Gemini or deterministic.
 */
function suggestionsFor(category: string | null, profile: Profile): string[] {
  const polluted = category === 'Poor' || category === 'Very Poor' || category === 'Severe'
  const questions = [
    'Is it safe to go running today?',
    polluted ? 'What should we do indoors while AQI is this high?' : 'Should I open windows tonight?',
  ]
  if (profile.children > 0) {
    questions.push('What should my child do about school and outdoor play today?')
  } else if (profile.elderly > 0) {
    questions.push('How should older adults in my home adjust today?')
  }
  questions.push(
    profile.commute === 'Petrol car' || profile.commute === 'Two-wheeler'
      ? 'Should we take the metro instead of the car?'
      : 'Should we change our commute route today?',
  )
  questions.push('How do I choose an air purifier?')
  return [...new Set(questions)].slice(0, 5)
}

export default function AIAdvisor() {
  const { air, planner, profile, location } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'I can help with today’s pollution, commute choices, indoor air and family precautions. I use the current model data and your saved preferences. I will say when data is unavailable.',
      // The opening message is static server-independent copy, but it is still
      // deterministic Vayu text rather than model output, and the provenance
      // badge is deliberately shown for every assistant message including this
      // one (see App.test.tsx).
      source: 'fallback',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const assessment = air.data?.model.assessment
  const pm25 = pollutantValue(assessment?.pollutants, 'pm25')
  const suggestions = suggestionsFor(assessment?.category ?? null, profile)

  const send = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault()
    const question = (preset ?? input).trim()
    if (!question || loading) return
    setInput('')
    setMessages(previous => [...previous, { role: 'user', text: question }])
    setLoading(true)
    const answer = await askVayu({
      message: question,
      context: {
        city: location.city,
        aqi: assessment?.aqi ?? null,
        category: assessment?.category ?? null,
        pm25,
        bestWindow: planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : null,
        worstWindow: planner.worstWindow ? `${planner.worstWindow.start}–${planner.worstWindow.end}` : null,
        profile,
      },
    })
    setMessages(previous => [
      ...previous,
      { role: 'assistant', text: answer.answer, sources: answer.sources, source: answer.source },
    ])
    setLoading(false)
  }

  // A suggested question is a one-tap action: pressing it asks it, rather than
  // only copying the text into the input and making the user press send too.
  const askSuggestion = (question: string) => {
    if (loading) return
    void send(undefined, question)
  }

  return (
    <div className="page advisor-page">
      <PageHeading
        eyebrow="AI ADVISOR"
        title="How can I help protect your family?"
        description="Grounded in provider data and household preferences. Deterministic fallback works without Gemini."
      />

      <div className="advisor-layout">
        <aside>
          <div className="advisor-profile">
            <div className="bot-avatar large"><Bot size={24} aria-hidden="true" /></div>
            <h2>Vayu assistant</h2>
            <p>Current location: {location.city}</p>
            <p>Estimated AQI: {assessment?.aqi ?? 'unavailable'}</p>
            <p>Cleaner window: {planner.bestWindow ? `${planner.bestWindow.start}–${planner.bestWindow.end}` : 'unavailable'}</p>
          </div>
          <div className="suggested">
            <small>SUGGESTED QUESTIONS</small>
            {suggestions.map(question => (
              <button key={question} type="button" onClick={() => askSuggestion(question)} disabled={loading}>
                {question}
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
        </aside>

        <section className="conversation" aria-label="Conversation with Vayu">
          <div className="messages" aria-live="polite">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                {message.role === 'assistant' && <div className="bot-avatar"><Bot size={16} aria-hidden="true" /></div>}
                <div className="message-body">
                  <p>{message.text}</p>
                  {message.role === 'assistant' && message.source === 'fallback' && (
                    <small className="message-source">Deterministic guidance</small>
                  )}
                  {message.role === 'assistant' && message.source === 'gemini' && (
                    <small className="message-source">AI-assisted, checked against Vayu safety rules</small>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <small className="message-source"><SourceLinks sources={message.sources} prefix="Sources: " /></small>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message assistant">
                <div className="bot-avatar"><Bot size={16} aria-hidden="true" /></div>
                <div className="message-body"><p>Checking the current data and preparing guidance…</p></div>
              </div>
            )}
          </div>

          <form className="chat-input" onSubmit={send}>
            <label className="sr-only" htmlFor="advisor-input">Ask Vayu a question</label>
            <input
              id="advisor-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send()
                }
              }}
              placeholder="Ask about pollution, health or low-emission choices…"
              maxLength={800}
              disabled={loading}
            />
            <button type="submit" aria-label="Send message" disabled={loading || input.trim().length === 0}>
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="ai-disclaimer">
            <Sparkles size={12} aria-hidden="true" /> AI guidance can be incomplete. It is not medical advice. Numerical
            environmental context comes from provider data or deterministic functions.
          </p>
        </section>
      </div>
    </div>
  )
}
