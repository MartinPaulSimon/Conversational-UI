'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Upload, Sparkles, X, FileText, Clock, Users, Filter,
  BrainCircuit, Briefcase, MapPin, GraduationCap, Building2, ChevronRight,
  UserMinus, GitCompare, Zap,
} from 'lucide-react';

// ===== TYPES =====
interface Candidate {
  id: string;
  name: string;
  role: string;
  skills: string[];
  experience: number;
  location: string;
  domain: string;
  company?: string;
  education?: string;
  finalScore: number;
  reasoning: string[];
  factors: {
    skill: number;
    role: number;
    experience: number;
    domain: number;
    trajectory: number;
    referral: number;
    risk: number;
  };
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  candidates?: Candidate[];
  suggestions?: string[];
  followUps?: string[];
  timestamp: number;
}

interface JDParsed {
  role: string;
  skills: string[];
  experience: string;
  domain: string;
  responsibilities: string[];
  nice_to_have: string[];
}

// ===== SCORE CIRCLE COMPONENT =====
function ScoreCircle({ score }: { score: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 85 ? '#22c55e' : score >= 70 ? '#84cc16' : score >= 55 ? '#eab308' : '#f97316';

  return (
    <div className="score-circle" style={{ color }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={radius} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <span style={{ position: 'relative', zIndex: 1, fontSize: '14px', fontWeight: 700 }}>{score}</span>
    </div>
  );
}

// ===== COMPARISON MODAL =====
function ComparisonView({
  candidates,
  onClose,
}: {
  candidates: Candidate[];
  onClose: () => void;
}) {
  const factorLabels: { key: keyof Candidate['factors']; label: string }[] = [
    { key: 'skill', label: 'Skills' },
    { key: 'role', label: 'Role Fit' },
    { key: 'experience', label: 'Experience' },
    { key: 'domain', label: 'Domain' },
    { key: 'trajectory', label: 'Trajectory' },
    { key: 'referral', label: 'Referral' },
    { key: 'risk', label: 'Risk' },
  ];

  return (
    <div className="comparison-overlay" onClick={onClose}>
      <div className="comparison-modal" onClick={e => e.stopPropagation()}>
        <div className="comparison-header">
          <h3><GitCompare size={16} style={{ display: 'inline', marginRight: 8 }} />Candidate Comparison</h3>
          <button onClick={onClose} className="comparison-close"><X size={18} /></button>
        </div>

        <div className="comparison-grid" style={{ gridTemplateColumns: `160px repeat(${candidates.length}, 1fr)` }}>
          {/* Header Row */}
          <div className="comparison-label" />
          {candidates.map(c => (
            <div key={c.id} className="comparison-candidate-header">
              <div className="candidate-avatar" style={{ width: 36, height: 36, fontSize: 13 }}>
                {c.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div className="comparison-name">{c.name}</div>
              <div className="comparison-role">{c.role}</div>
              <div className="comparison-score-badge">
                <Zap size={10} /> {c.finalScore}
              </div>
            </div>
          ))}

          {/* Skills Row */}
          <div className="comparison-label">Skills</div>
          {candidates.map(c => (
            <div key={c.id} className="comparison-cell">
              <div className="comparison-tags">
                {c.skills.slice(0, 4).map(s => (
                  <span key={s} className="skill-tag" style={{ fontSize: 10, padding: '2px 6px' }}>{s}</span>
                ))}
                {c.skills.length > 4 && <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>+{c.skills.length - 4}</span>}
              </div>
            </div>
          ))}

          {/* Experience */}
          <div className="comparison-label">Experience</div>
          {candidates.map(c => (
            <div key={c.id} className="comparison-cell comparison-highlight">
              {c.experience} years
            </div>
          ))}

          {/* Location */}
          <div className="comparison-label">Location</div>
          {candidates.map(c => (
            <div key={c.id} className="comparison-cell">{c.location}</div>
          ))}

          {/* Company */}
          <div className="comparison-label">Company</div>
          {candidates.map(c => (
            <div key={c.id} className="comparison-cell">{c.company || '—'}</div>
          ))}

          {/* Education */}
          <div className="comparison-label">Education</div>
          {candidates.map(c => (
            <div key={c.id} className="comparison-cell">{c.education || '—'}</div>
          ))}

          {/* Factor Scores */}
          {factorLabels.map(f => (
            <>
              <div key={`label-${f.key}`} className="comparison-label">{f.label}</div>
              {candidates.map(c => {
                const val = c.factors[f.key];
                const isRisk = f.key === 'risk';
                const barColor = isRisk
                  ? val > 15 ? '#ef4444' : val > 10 ? '#f97316' : '#22c55e'
                  : val >= 85 ? '#22c55e' : val >= 70 ? '#84cc16' : val >= 55 ? '#eab308' : '#f97316';
                return (
                  <div key={c.id} className="comparison-cell">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                      <div className="score-bar-bg" style={{ flex: 1, height: 6 }}>
                        <div className="score-bar-fill" style={{ width: `${val}%`, background: barColor, height: 6 }} />
                      </div>
                      <span style={{ fontSize: 11, color: barColor, fontWeight: 600, minWidth: 28 }}>{val}%</span>
                    </div>
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== CANDIDATE CARD COMPONENT =====
function CandidateCard({
  candidate,
  index,
  onExclude,
  compareSelected,
  onToggleCompare,
}: {
  candidate: Candidate;
  index: number;
  onExclude: (id: string) => void;
  compareSelected: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const initials = candidate.name.split(' ').map(n => n[0]).join('');

  return (
    <div
      className={`candidate-card ${compareSelected ? 'compare-selected' : ''}`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="candidate-header" onClick={() => setExpanded(!expanded)}>
        <div className="candidate-avatar">{initials}</div>
        <div className="candidate-info">
          <div className="candidate-name">{candidate.name}</div>
          <div className="candidate-role">{candidate.role}</div>
        </div>
        <div className="candidate-score">
          <ScoreCircle score={candidate.finalScore} />
          <span className="score-label">Match</span>
        </div>
      </div>

      <div className="candidate-skills">
        {candidate.skills.slice(0, 5).map(skill => (
          <span key={skill} className="skill-tag">{skill}</span>
        ))}
        {candidate.skills.length > 5 && (
          <span className="skill-tag" style={{ opacity: 0.6 }}>+{candidate.skills.length - 5}</span>
        )}
      </div>

      <div className="candidate-meta">
        <span className="candidate-meta-item">
          <Briefcase size={12} /> {candidate.experience} yrs
        </span>
        <span className="candidate-meta-item">
          <MapPin size={12} /> {candidate.location}
        </span>
        {candidate.company && (
          <span className="candidate-meta-item">
            <Building2 size={12} /> {candidate.company}
          </span>
        )}
        {candidate.education && (
          <span className="candidate-meta-item">
            <GraduationCap size={12} /> {candidate.education.split(' - ')[0]}
          </span>
        )}
      </div>

      {/* Score Breakdown Bar */}
      <div className="score-bar-container">
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', minWidth: '45px' }}>Skills</span>
        <div className="score-bar-bg">
          <div
            className="score-bar-fill"
            style={{ width: `${candidate.factors.skill}%`, background: 'var(--accent-gradient)' }}
          />
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '30px', textAlign: 'right' }}>
          {candidate.factors.skill}%
        </span>
      </div>

      {/* Action Buttons */}
      <div className="card-actions">
        <button
          className="card-action-btn compare-btn"
          onClick={(e) => { e.stopPropagation(); onToggleCompare(candidate.id); }}
          title={compareSelected ? 'Remove from comparison' : 'Add to comparison'}
        >
          <GitCompare size={12} />
          {compareSelected ? 'Selected' : 'Compare'}
        </button>
        <button
          className="card-action-btn exclude-btn"
          onClick={(e) => { e.stopPropagation(); onExclude(candidate.id); }}
          title="Exclude from results"
        >
          <UserMinus size={12} />
          Exclude
        </button>
      </div>

      {expanded && (
        <div className="candidate-reasoning fade-in">
          <div className="reasoning-title">Why This Candidate Matches</div>
          <ul className="reasoning-list">
            {candidate.reasoning.map((point, i) => (
              <li key={i} className="reasoning-item">
                <span className="reasoning-bullet">●</span>
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ===== MAIN PAGE COMPONENT =====
// ===== MULTI-STEP PROGRESS LOADER =====
const STATUS_STEPS = [
  'Understanding your hiring requirement…',
  'Scanning candidate profiles...',
  'Extracting skills and experience...',
  'Analyzing candidate-job fit...',
  'Matching top candidates...',
  'Ranking profiles by relevance...',
  'Shortlisting best talent...',
  'Almost ready...',
];

function StatusText() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep(prev => {
        if (prev < STATUS_STEPS.length - 1) return prev + 1;
        return prev; // Stay on last step
      });
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="progress-steps">
      {STATUS_STEPS.map((step, i) => {
        const isDone = i < activeStep;
        const isActive = i === activeStep;
        const isPending = i > activeStep;

        if (isPending) return null; // Only show completed + active

        return (
          <div
            key={i}
            className={`progress-step ${isDone ? 'step-done' : ''} ${isActive ? 'step-active' : ''}`}
          >
            <div className="step-indicator">
              {isDone ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="7" fill="#22c55e" />
                  <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <div className="status-spinner" />
              )}
            </div>
            <span className="step-label">{step}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [jdParsed, setJdParsed] = useState<JDParsed | null>(null);
  const [jdUploading, setJdUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [activeFilters, setActiveFilters] = useState<Record<string, unknown>>({});
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [selectedCTA, setSelectedCTA] = useState<string | null>(null);
  const [moodEmoji, setMoodEmoji] = useState('👋');
  const [moodLabel, setMoodLabel] = useState('Welcome');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const res = await fetch('/api/session/create', { method: 'POST' });
        const data = await res.json();
        setSessionId(data.sessionId);
      } catch (err) {
        console.error('Failed to create session:', err);
        setSessionId('local-' + Date.now());
      }
    };
    initSession();
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Textarea auto-resize
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  }, []);

  // Send message
  const sendMessage = useCallback(async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const userMessage: Message = {
      id: `msg-${Date.now()}-user`, role: 'user', content: msg, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    try {
      const res = await fetch(`/api/session/${sessionId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      // Filter out excluded candidates on client side too
      const filteredCandidates = (data.candidates || []).filter(
        (c: Candidate) => !excludedIds.includes(c.id)
      );

      const aiMessage: Message = {
        id: `msg-${Date.now()}-ai`, role: 'ai', content: data.message,
        candidates: filteredCandidates, suggestions: data.suggestions,
        followUps: data.followUps || [],
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setTotalResults(data.totalResults || filteredCandidates.length);
      setActiveFilters(data.filters || {});

      // Update mood emoji based on results
      if (filteredCandidates.length >= 3) {
        setMoodEmoji('🎉'); setMoodLabel('Great matches!');
      } else if (filteredCandidates.length > 0) {
        setMoodEmoji('😊'); setMoodLabel('Found some');
      } else {
        setMoodEmoji('🤔'); setMoodLabel('Try refining');
      }

      // Track all seen candidates for comparison
      if (filteredCandidates.length > 0) {
        setAllCandidates(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          return [...prev, ...filteredCandidates.filter((c: Candidate) => !existingIds.has(c.id))];
        });
      }
    } catch (err) {
      console.error('Failed:', err);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-err`, role: 'ai',
        content: 'I encountered an issue. Please try again.', timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, sessionId, excludedIds]);

  // Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  // JD Upload
  const handleJDUpload = useCallback(async (file: File) => {
    if (!sessionId) return;
    setJdUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/session/${sessionId}/jd`, { method: 'POST', body: formData });
      const data = await res.json();
      setJdParsed(data.parsed);
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-jd`, role: 'ai', content: data.message,
        suggestions: ['Find matching candidates', 'Show me top 5 matches', 'Search with these skills'],
        timestamp: Date.now(),
      }]);
    } catch (err) { console.error('JD upload failed:', err); }
    finally { setJdUploading(false); }
  }, [sessionId]);

  // Drag & Drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleJDUpload(file);
  }, [handleJDUpload]);

  // Exclude candidate
  const handleExclude = useCallback((id: string) => {
    setExcludedIds(prev => [...prev, id]);
    setCompareIds(prev => prev.filter(cid => cid !== id));
    // Remove from visible messages
    setMessages(prev => prev.map(msg => ({
      ...msg,
      candidates: msg.candidates?.filter(c => c.id !== id),
    })));
  }, []);

  // Toggle compare
  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds(prev => {
      if (prev.includes(id)) return prev.filter(cid => cid !== id);
      if (prev.length >= 3) return prev; // Max 3
      return [...prev, id];
    });
  }, []);

  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const welcomeSuggestions = [
    { icon: '🔍', label: 'Skill Search', hint: 'Find React developers with 5+ years experience', question: 'Which specific technology or skill are you looking for in candidates?' },
    { icon: '🏢', label: 'Location Search', hint: 'Show me senior engineers in Bangalore', question: 'Which preferred location are you looking for candidates in?' },
    { icon: '🤖', label: 'Domain Search', hint: 'Find AI/ML engineers with Python expertise', question: 'Which domain or industry are you hiring for?' },
    { icon: '📊', label: 'Data Talent', hint: 'Search for data engineers with Spark experience', question: 'What kind of data role are you looking to fill?' },
  ];

  const handleCTAClick = useCallback((s: { icon: string; label: string; hint: string; question: string }) => {
    setSelectedCTA(s.label);
    setMoodEmoji('💭'); setMoodLabel('Listening...');
    // Add an AI message asking the contextual question
    const aiQuestion: Message = {
      id: `msg-${Date.now()}-cta`, role: 'ai',
      content: `Great choice! You selected **${s.label}**. ${s.question}`,
      suggestions: [s.hint],
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, aiQuestion]);
    // Focus input for user to type their answer
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const compareCandidates = allCandidates.filter(c => compareIds.includes(c.id));

  return (
    <div className="app-container">
      {/* ===== COMPARISON MODAL ===== */}
      {showComparison && compareCandidates.length >= 2 && (
        <ComparisonView
          candidates={compareCandidates}
          onClose={() => setShowComparison(false)}
        />
      )}

      {/* ===== SIDEBAR ===== */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">
              <BrainCircuit size={22} />
            </div>
            <div>
              <h1>NestRecruit</h1>
              <p>AI Recruiter Co-pilot</p>
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          {/* JD Upload */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Job Description</div>
            {!jdParsed ? (
              <div
                className={`jd-upload-area ${dragging ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
              >
                <div className="jd-upload-icon">
                  {jdUploading ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                    </div>
                  ) : (
                    <Upload size={28} />
                  )}
                </div>
                <div className="jd-upload-text">
                  {jdUploading ? 'Analyzing JD...' : 'Upload Job Description'}
                </div>
                <div className="jd-upload-hint">
                  {jdUploading ? 'Extracting skills, role & requirements' : 'Drop a file or click to browse'}
                </div>
                <input
                  ref={fileInputRef} type="file" accept=".txt,.pdf,.doc,.docx"
                  style={{ display: 'none' }}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleJDUpload(file); }}
                />
              </div>
            ) : (
              <div className="jd-summary slide-up">
                <div className="jd-summary-header">
                  <h3><FileText size={14} style={{ display: 'inline', marginRight: '6px' }} />Parsed JD</h3>
                  <button className="jd-summary-remove" onClick={() => setJdParsed(null)}><X size={16} /></button>
                </div>
                <div className="jd-field">
                  <div className="jd-field-label">Role</div>
                  <div className="jd-field-value">{jdParsed.role}</div>
                </div>
                <div className="jd-field">
                  <div className="jd-field-label">Experience</div>
                  <div className="jd-field-value">{jdParsed.experience}</div>
                </div>
                <div className="jd-field">
                  <div className="jd-field-label">Domain</div>
                  <div className="jd-field-value">{jdParsed.domain}</div>
                </div>
                <div className="jd-field">
                  <div className="jd-field-label">Skills</div>
                  <div className="jd-tags">
                    {jdParsed.skills.map(s => (
                      <span key={s} className="jd-tag">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Session Info */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Session</div>
            <div className="session-info">
              <div className="session-stat">
                <span className="session-stat-label"><Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />Messages</span>
                <span className="session-stat-value">{messages.length}</span>
              </div>
              <div className="session-stat">
                <span className="session-stat-label"><Users size={12} style={{ display: 'inline', marginRight: '4px' }} />Results Found</span>
                <span className="session-stat-value">{totalResults}</span>
              </div>
              <div className="session-stat">
                <span className="session-stat-label"><Filter size={12} style={{ display: 'inline', marginRight: '4px' }} />Active Filters</span>
                <span className="session-stat-value">
                  {Object.values(activeFilters).filter(v => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true)).length}
                </span>
              </div>
              {excludedIds.length > 0 && (
                <div className="session-stat">
                  <span className="session-stat-label"><UserMinus size={12} style={{ display: 'inline', marginRight: '4px' }} />Excluded</span>
                  <span className="session-stat-value">{excludedIds.length}</span>
                </div>
              )}
            </div>
          </div>

          {/* Compare Button */}
          {compareIds.length >= 2 && (
            <div className="sidebar-section">
              <button
                className="compare-action-btn"
                onClick={() => setShowComparison(true)}
              >
                <GitCompare size={14} />
                Compare {compareIds.length} candidates
              </button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {[
                { label: 'Show all candidates', icon: Users, command: 'Show all candidates' },
                { label: 'Top rated matches', icon: Sparkles, command: 'Show me the top rated candidates with highest match scores' },
                { label: 'Reset filters', icon: Filter, command: 'Reset all filters and clear search' },
              ].map(action => (
                <button
                  key={action.label}
                  className="quick-action-btn"
                  onClick={() => {
                    setMoodEmoji('⚡'); setMoodLabel('Working...');
                    sendMessage(action.command);
                  }}
                >
                  <action.icon size={14} />
                  {action.label}
                  <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.4 }} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* ===== CHAT AREA ===== */}
      <main className="chat-area">
        <div className="chat-header">
          <span className="chat-header-title">
            <Sparkles size={16} style={{ display: 'inline', marginRight: '8px', color: 'var(--accent-secondary)' }} />
            AI Candidate Search
          </span>
          <div className="chat-header-status emoji-status">
            <span className="mood-emoji">{moodEmoji}</span>
            <span className="mood-label">{moodLabel}</span>
          </div>
        </div>

        <div className="chat-messages">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-icon">
                <BrainCircuit size={36} color="white" />
              </div>
              <h2 className="welcome-title">Welcome to NestRecruit</h2>
              <p className="welcome-subtitle">
                I&apos;m your AI recruiter co-pilot. Tell me what you&apos;re looking for, and I&apos;ll find
                the best candidates — ranked by skill alignment, experience, and domain expertise.
              </p>
              <div className="welcome-suggestions">
                {welcomeSuggestions.map(s => (
                  <button
                    key={s.label}
                    className={`welcome-suggestion ${selectedCTA === s.label ? 'cta-selected' : ''}`}
                    onClick={() => handleCTAClick(s)}
                  >
                    <div className="welcome-suggestion-icon">{s.icon}</div>
                    <div>{s.label}</div>
                    <div className="welcome-suggestion-text">{s.hint}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'user' ? 'U' : <BrainCircuit size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="message-content">{msg.content}</div>

                  {/* Candidate Cards */}
                  {msg.candidates && msg.candidates.length > 0 && (
                    <div className="candidates-grid">
                      {msg.candidates.map((c, i) => (
                        <CandidateCard
                          key={c.id}
                          candidate={c}
                          index={i}
                          onExclude={handleExclude}
                          compareSelected={compareIds.includes(c.id)}
                          onToggleCompare={handleToggleCompare}
                        />
                      ))}
                    </div>
                  )}

                  {/* Follow-up Questions */}
                  {msg.followUps && msg.followUps.length > 0 && (
                    <div className="followup-questions">
                      {msg.followUps.map((q, i) => (
                        <div key={i} className="followup-question">
                          <div className="followup-icon">{i === 0 ? '💡' : i === 1 ? '🎯' : '🔍'}</div>
                          <div className="followup-text">{q}</div>
                          <button
                            className="followup-answer-btn"
                            onClick={() => {
                              setInput(q);
                              if (inputRef.current) {
                                inputRef.current.focus();
                              }
                            }}
                          >
                            Answer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Suggestion Chips */}
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="suggestion-chips">
                      {msg.suggestions.map(s => (
                        <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="message-time">{formatTime(msg.timestamp)}</div>
                </div>
              </div>
            ))
          )}

          {/* Status Loader */}
          {loading && (
            <div className="status-loader">
              <div className="message-avatar" style={{
                width: '36px', height: '36px', minWidth: '36px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent-tertiary)',
              }}>
                <BrainCircuit size={16} />
              </div>
              <StatusText />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          <div className="chat-input-wrapper">
            <button className="input-btn" onClick={() => fileInputRef.current?.click()} title="Upload JD">
              <Upload size={18} />
            </button>
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Search for candidates... (e.g., 'Find React developers with 5+ years experience')"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
              <Send size={18} />
            </button>
          </div>
          <div className="input-hint">
            Press Enter to send · Shift+Enter for new line · Upload JD to auto-search
          </div>
        </div>
      </main>
    </div>
  );
}
