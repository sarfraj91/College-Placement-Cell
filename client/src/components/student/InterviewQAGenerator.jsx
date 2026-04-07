import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  Loader2,
  MessageCircle,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Upload,
} from "lucide-react";

import {
  evaluateInterviewAnswer,
  generateInterviewAnswer,
  generateInterviewFollowUp,
  generateInterviewQuestions,
} from "../../services/interviewQaApi.jsx";


const ROLE_OPTIONS = ["frontend", "backend", "full stack"];

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"];

const createQuestionState = (item = {}) => ({
  id: item.id || String(Math.random()),
  question: item.question || "",
  focusArea: item.focusArea || "",
  questionType: item.questionType || "",
  difficulty: item.difficulty || "medium",
  role: item.role || "full stack",
  personalization: item.personalization || "",
  answer: "",
  highlights: [],
  answerFramework: [],
  answerLoading: false,
  followUp: null,
  followUpLoading: false,
  userAnswer: "",
  feedback: null,
  feedbackLoading: false,
});

const formatLabel = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const InfoListCard = ({ title, items, emptyText }) => (
  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{title}</p>
    {items.length ? (
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li
            key={`${title}-${item}`}
            className="rounded-[18px] border border-white/10 bg-slate-950/25 px-3 py-3 text-sm leading-6 text-slate-100"
          >
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="mt-4 text-sm leading-7 text-slate-400">{emptyText}</p>
    )}
  </div>
);

const FeedbackList = ({ title, items, tone, icon }) => (
  <div
    className={`rounded-[22px] border p-4 ${
      tone === "good"
        ? "border-emerald-300/20 bg-emerald-400/8"
        : "border-rose-300/20 bg-rose-400/8"
    }`}
  >
    <div className="mb-3 flex items-center gap-3">
      <div className="rounded-2xl bg-black/15 p-3">{icon}</div>
      <p className="text-sm font-semibold text-slate-50">{title}</p>
    </div>
    {items.length ? (
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={`${title}-${item}`}
            className="rounded-[18px] border border-white/10 bg-slate-950/25 px-3 py-3 text-sm leading-6 text-slate-100"
          >
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm leading-7 text-slate-400">
        {title === "Strengths"
          ? "Your strengths will appear here after feedback is generated."
          : "Weaknesses and missing signals will appear here after feedback is generated."}
      </p>
    )}
  </div>
);

const InterviewQAGenerator = () => {
  const [resumeFile, setResumeFile] = useState(null);
  const [role, setRole] = useState("full stack");
  const [difficulty, setDifficulty] = useState("medium");
  const [resumeContext, setResumeContext] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const currentQuestion =
    questions.find((item) => item.id === selectedQuestionId) || null;

  const patchQuestion = (questionId, updates) => {
    setQuestions((previous) =>
      previous.map((item) =>
        item.id === questionId ? { ...item, ...updates } : item,
      ),
    );
  };

  const handleResumeChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setPageError("");

    if (!nextFile) {
      setResumeFile(null);
      return;
    }

    const isPdf =
      nextFile.type === "application/pdf" ||
      nextFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResumeFile(null);
      setPageError("Please upload a PDF resume only.");
      return;
    }

    setResumeFile(nextFile);
  };

  const handleGenerateQuestions = async () => {
    if (!resumeFile) {
      setPageError("Upload your resume PDF first.");
      return;
    }

    try {
      setGeneratingQuestions(true);
      setPageError("");
      setNotice("");

      const data = await generateInterviewQuestions({
        resumeFile,
        role,
        difficulty,
        excludeQuestions: questions.map((item) => item.question),
      });

      const nextQuestions = Array.isArray(data?.questions)
        ? data.questions.map((item) => createQuestionState(item))
        : [];

      setQuestions(nextQuestions);
      setSelectedQuestionId(nextQuestions[0]?.id || "");
      setResumeContext(data?.profile || null);
      setNotice(data?.warning || "");

      if (!nextQuestions.length) {
        setPageError("No questions were generated from this resume yet.");
      }
    } catch (error) {
      setPageError(
        error?.response?.data?.message ||
          "Unable to generate interview questions right now.",
      );
    } finally {
      setGeneratingQuestions(false);
    }
  };

  const requestAnswer = async (questionItem, regenerate = false) => {
    if (!questionItem?.question) {
      return;
    }

    try {
      patchQuestion(questionItem.id, { answerLoading: true });
      setPageError("");

      const data = await generateInterviewAnswer({
        question: questionItem.question,
        role,
        difficulty,
        previousAnswers: regenerate && questionItem.answer ? [questionItem.answer] : [],
        resumeSummary: resumeContext?.resumeSummary || "",
        resumeSkills: resumeContext?.resumeSkills || [],
      });

      patchQuestion(questionItem.id, {
        answer: data?.answer || "",
        highlights: Array.isArray(data?.highlights) ? data.highlights : [],
        answerFramework: Array.isArray(data?.answerFramework)
          ? data.answerFramework
          : [],
        answerLoading: false,
      });

      if (data?.warning) {
        setNotice(data.warning);
      }
    } catch (error) {
      patchQuestion(questionItem.id, { answerLoading: false });
      setPageError(
        error?.response?.data?.message ||
          "Unable to generate an answer for this question right now.",
      );
    }
  };

  const handleGetFeedback = async () => {
    if (!currentQuestion?.question || !currentQuestion.userAnswer.trim()) {
      setPageError("Write your answer first to get feedback.");
      return;
    }

    try {
      patchQuestion(currentQuestion.id, { feedbackLoading: true });
      setPageError("");

      const data = await evaluateInterviewAnswer({
        question: currentQuestion.question,
        userAnswer: currentQuestion.userAnswer,
        role,
        difficulty,
      });

      patchQuestion(currentQuestion.id, {
        feedbackLoading: false,
        feedback: {
          strengths: Array.isArray(data?.strengths) ? data.strengths : [],
          weaknesses: Array.isArray(data?.weaknesses) ? data.weaknesses : [],
          improvedAnswer: data?.improvedAnswer || "",
          verdict: data?.verdict || "",
          score: Number(data?.score ?? 0) || 0,
        },
      });

      if (data?.warning) {
        setNotice(data.warning);
      }
    } catch (error) {
      patchQuestion(currentQuestion.id, { feedbackLoading: false });
      setPageError(
        error?.response?.data?.message ||
          "Unable to review your answer right now.",
      );
    }
  };

  const handleFollowUp = async () => {
    if (!currentQuestion?.question || !currentQuestion.answer) {
      setPageError("Generate the answer first, then ask a follow-up question.");
      return;
    }

    try {
      patchQuestion(currentQuestion.id, { followUpLoading: true });
      setPageError("");

      const data = await generateInterviewFollowUp({
        question: currentQuestion.question,
        userAnswer: currentQuestion.userAnswer.trim() || currentQuestion.answer,
        role,
        difficulty,
      });

      patchQuestion(currentQuestion.id, {
        followUpLoading: false,
        followUp: {
          question: data?.followUpQuestion || "",
          reason: data?.reason || "",
        },
      });

      if (data?.warning) {
        setNotice(data.warning);
      }
    } catch (error) {
      patchQuestion(currentQuestion.id, { followUpLoading: false });
      setPageError(
        error?.response?.data?.message ||
          "Unable to generate a follow-up question right now.",
      );
    }
  };

  useEffect(() => {
    const selected = questions.find((item) => item.id === selectedQuestionId);

    if (!selected || selected.answer || selected.answerLoading) {
      return;
    }

    void requestAnswer(selected);
  }, [questions, selectedQuestionId, role, difficulty, resumeContext]);

  return (
    <div className="page-shell">
      <div className="page-inner max-w-[1380px] space-y-6">
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl space-y-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Interview Q&amp;A Generator
              </p>
              <h1 className="section-title">Upload resume, choose role and difficulty, then practice from a cleaner question-answer flow.</h1>
              <p className="text-sm leading-7 text-slate-300">
                Questions are generated from your uploaded resume, role, and difficulty. Select a question on the left and review its answer, follow-up, and feedback on the right.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_220px_220px_190px]">
            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Resume PDF</span>
              <div className="rounded-[18px] border border-dashed border-white/14 bg-slate-950/25 p-4">
                <input type="file" accept=".pdf,application/pdf" onChange={handleResumeChange} className="input border-0 bg-transparent px-0 py-0 shadow-none file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:font-semibold file:text-cyan-100" />
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                  <Upload size={16} className="text-cyan-200" />
                  {resumeFile ? resumeFile.name : "Upload your resume to generate questions"}
                </div>
              </div>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Role</span>
              <select value={role} onChange={(event) => setRole(event.target.value)} className="select">
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Difficulty</span>
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className="select">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{formatLabel(option)}</option>
                ))}
              </select>
            </label>

            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Action</span>
              <button type="button" onClick={handleGenerateQuestions} disabled={generatingQuestions} className="btn-primary mt-1 w-full">
                {generatingQuestions ? <><Loader2 size={16} className="animate-spin" />Generating...</> : <><Sparkles size={16} />Generate Questions</>}
              </button>
            </div>
          </div>

          {resumeContext ? (
            <div className="mt-4 rounded-[20px] border border-white/10 bg-slate-950/25 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <FileText size={16} className="text-emerald-200" />
                <p className="text-sm font-medium text-slate-100">
                  {resumeContext.resumeFilename || resumeFile?.name || "Resume uploaded"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(resumeContext.resumeSkills || []).slice(0, 8).map((skill) => (
                  <span key={skill} className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-100">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {pageError ? <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{pageError}</p> : null}
          {notice ? <p className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">{notice}</p> : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="glass-card p-4">
            <div className="flex items-center justify-between gap-3 border-b border-white/8 px-2 pb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Questions</p>
                <h2 className="mt-1 font-['Sora'] text-lg font-semibold text-slate-50">Resume-Based Set</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{questions.length}</span>
            </div>

            <div className="mt-4 max-h-[920px] space-y-3 overflow-y-auto pr-1">
              {questions.length ? questions.map((item, index) => {
                const active = item.id === selectedQuestionId;
                return (
                  <button key={item.id} type="button" onClick={() => setSelectedQuestionId(item.id)} className={`w-full rounded-[20px] border px-4 py-4 text-left transition ${active ? "border-cyan-300/45 bg-cyan-400/12" : "border-white/10 bg-white/5 hover:bg-white/8"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="rounded-full border border-white/10 bg-slate-950/25 px-2.5 py-1 text-[11px] text-slate-300">Q{index + 1}</span>
                      <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{item.questionType || item.focusArea || "Question"}</span>
                    </div>
                    <p className="mt-3 text-sm font-medium leading-6 text-slate-100">{item.question}</p>
                  </button>
                );
              }) : (
                <div className="rounded-[20px] border border-dashed border-white/14 bg-white/4 px-4 py-5 text-sm leading-6 text-slate-400">
                  Upload a resume and generate questions to populate this list.
                </div>
              )}
            </div>
          </aside>

          <div className="space-y-6">
            <section className="glass-card p-6">
              {currentQuestion ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <span className="badge">{formatLabel(currentQuestion.role)}</span>
                        <span className="badge">{formatLabel(currentQuestion.difficulty)}</span>
                      </div>
                      <h2 className="font-['Sora'] text-2xl font-semibold leading-tight text-slate-50">{currentQuestion.question}</h2>
                    </div>
                    <button type="button" onClick={() => requestAnswer(currentQuestion, true)} disabled={currentQuestion.answerLoading} className="btn-secondary">
                      {currentQuestion.answerLoading ? <><Loader2 size={16} className="animate-spin" />Regenerating...</> : <><Sparkles size={16} />Regenerate Answer</>}
                    </button>
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-slate-950/25 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Generated Answer</p>
                    <div className="mt-4">
                      {currentQuestion.answerLoading ? (
                        <div className="flex items-center gap-3 text-sm text-slate-300"><Loader2 size={18} className="animate-spin" />Generating a resume-aware answer...</div>
                      ) : currentQuestion.answer ? (
                        <p className="whitespace-pre-line text-[15px] leading-8 text-slate-100">{currentQuestion.answer}</p>
                      ) : (
                        <p className="text-sm leading-7 text-slate-400">Choose a question to load its answer.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <InfoListCard title="Highlights" items={currentQuestion.highlights} emptyText="Important answer points will appear here." />
                    <InfoListCard title="Answer Structure" items={currentQuestion.answerFramework} emptyText="The answer structure will appear here." />
                  </div>

                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Follow-up</p>
                        <p className="mt-1 text-sm text-slate-300">Ask the deeper question in the same answer area.</p>
                      </div>
                      <button type="button" onClick={handleFollowUp} disabled={currentQuestion.followUpLoading} className="btn-ghost">
                        {currentQuestion.followUpLoading ? <><Loader2 size={16} className="animate-spin" />Thinking...</> : <><MessageCircle size={16} />Ask Follow-up</>}
                      </button>
                    </div>

                    <div className="mt-4 rounded-[18px] border border-white/10 bg-slate-950/25 p-4">
                      {currentQuestion.followUp?.question ? (
                        <>
                          <p className="text-sm font-semibold text-slate-100">{currentQuestion.followUp.question}</p>
                          {currentQuestion.followUp.reason ? <p className="mt-2 text-sm leading-6 text-slate-400">{currentQuestion.followUp.reason}</p> : null}
                        </>
                      ) : (
                        <p className="text-sm leading-7 text-slate-400">Generate the answer first, then ask for a deeper follow-up question here.</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-white/14 bg-white/4 px-6 py-16 text-center text-sm leading-7 text-slate-400">
                  Generate questions from your resume and select one from the left side to see the answer here.
                </div>
              )}
            </section>

            <section className="glass-card p-6">
              <div className="space-y-5">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Your Answer & Feedback</p>
                  <h2 className="mt-2 font-['Sora'] text-xl font-semibold text-slate-50">Write your answer, review strengths and weaknesses, then improve it.</h2>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-slate-950/25 p-4">
                  <label className="block">
                    <span className="input-label">Your Answer</span>
                    <textarea value={currentQuestion?.userAnswer || ""} onChange={(event) => currentQuestion && patchQuestion(currentQuestion.id, { userAnswer: event.target.value })} disabled={!currentQuestion} rows={10} className="textarea min-h-[220px] resize-y" placeholder="Write your answer for the selected question here..." />
                  </label>
                  <button type="button" onClick={handleGetFeedback} disabled={!currentQuestion || currentQuestion.feedbackLoading} className="btn-primary mt-4">
                    {currentQuestion?.feedbackLoading ? <><Loader2 size={16} className="animate-spin" />Reviewing...</> : <><ArrowRight size={16} />Get Feedback</>}
                  </button>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <FeedbackList title="Strengths" items={currentQuestion?.feedback?.strengths || []} tone="good" icon={<ThumbsUp size={16} className="text-emerald-200" />} />
                  <FeedbackList title="Weaknesses" items={currentQuestion?.feedback?.weaknesses || []} tone="warn" icon={<ThumbsDown size={16} className="text-rose-200" />} />
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-2xl bg-cyan-400/12 p-3">
                      <Sparkles size={16} className="text-cyan-200" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-50">Improved Answer</p>
                      {currentQuestion?.feedback?.verdict ? (
                        <p className="text-xs text-slate-400">
                          {currentQuestion.feedback.verdict}
                          {currentQuestion.feedback.score ? ` · Score ${currentQuestion.feedback.score}/100` : ""}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400">A polished version appears after feedback is generated.</p>
                      )}
                    </div>
                  </div>

                  {currentQuestion?.feedback?.improvedAnswer ? (
                    <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-100">{currentQuestion.feedback.improvedAnswer}</p>
                  ) : (
                    <p className="mt-4 text-sm leading-7 text-slate-400">Generate feedback to see the improved answer here.</p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
};

export default InterviewQAGenerator;
