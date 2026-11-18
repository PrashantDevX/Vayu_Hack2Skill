import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Bot, Send, Sparkles } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { askVayu } from '../services/chatService'
import type { ChatMessage } from '../types'

const SUGGESTIONS = [
  'Is it safe to go running today?',
  'Should I open windows tonight?',
  'How do I choose an air purifier?',
  'Should we take the metro instead of the car?',
  'What should my family do when AQI is severe?',
]

export default function AIAdvisor() {
  const { air, planner, profile, location } = useApp()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'I can help with today’s pollution, commute choices, indoor air and family precautions. I use the current model data and your saved preferences. I will say when data is unavailable.',
      source: 'fallback',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const assessment = air.data?.model.assessment
  const pm25 = assessment?.pollutants.find(item => item.key === 'pm25')?.value ?? null

  const send = async (event?: FormEvent) => {
    event?.preventDefault()
    const question = input.trim()
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

  const applySuggestion = (question: string) => {
    setInput(question)
  }

  return (
    <div className="page advisor-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AI ADVISOR</p>
          <h1>How can I help protect your family?</h1>
          <p>Grounded in provider data and household preferences. Deterministic fallback works without Gemini.</p>
        </div>
      </div>

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
            {SUGGESTIONS.map(question => (
              <button key={question} type="button" onClick={() => applySuggestion(question)}>
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
                  {message.role === 'assistant' && message.source === 'fallback' && index > 0 && (
                    <small className="message-source">Deterministic guidance · AI unavailable</small>
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <small className="message-source">Sources: {message.sources.join(' · ')}</small>
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
