import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BrainCircuit,
  FileText,
  Layers3,
  Loader2,
  MessageCircleMore,
  RefreshCcw,
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
import ParticleMesh from "../ui/ParticleMesh.jsx";
import "./InterviewQAGenerator.css";

const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"];
const QUESTION_BATCH_SIZE = 10;

const createQuestionState = (item = {}) => ({
  id: item.id || String(Math.random()),
  question: item.question || "",
  focusArea: item.focusArea || item.focus_area || "",
  questionType: item.questionType || item.question_type || "",
  difficulty: item.difficulty || "medium",
  role: item.role || "full stack",
  personalization: item.personalization || "",
  interviewerIntent: item.interviewerIntent || item.interviewer_intent || "",
  strongSignals: Array.isArray(item.strongSignals)
    ? item.strongSignals
    : Array.isArray(item.strong_signals)
      ? item.strong_signals
      : [],
  redFlags: Array.isArray(item.redFlags)
    ? item.redFlags
    : Array.isArray(item.red_flags)
      ? item.red_flags
      : [],
  answer: item.answer || "",
  highlights: Array.isArray(item.highlights) ? item.highlights : [],
  answerFramework: Array.isArray(item.answerFramework)
    ? item.answerFramework
    : Array.isArray(item.answer_framework)
      ? item.answer_framework
      : [],
  answerHook: item.answerHook || item.answer_hook || "",
  deliveryTips: Array.isArray(item.deliveryTips)
    ? item.deliveryTips
    : Array.isArray(item.delivery_tips)
      ? item.delivery_tips
      : [],
  pitfalls: Array.isArray(item.pitfalls) ? item.pitfalls : [],
  answerRequested: Boolean(item.answer),
  answerLoading: false,
  followUp: null,
  followUpLoading: false,
  userAnswer: "",
  feedback: null,
  feedbackLoading: false,
});

const formatLabel = (value = "") =>
  value
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const handleTiltMove = (event) => {
  if (event.pointerType === "touch") return;

  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  const rotateY = (x - 0.5) * 10;
  const rotateX = (0.5 - y) * 10;

  card.style.setProperty("--iqa-rotate-x", `${rotateX.toFixed(2)}deg`);
  card.style.setProperty("--iqa-rotate-y", `${rotateY.toFixed(2)}deg`);
  card.style.setProperty("--iqa-glow-x", `${(x * 100).toFixed(2)}%`);
  card.style.setProperty("--iqa-glow-y", `${(y * 100).toFixed(2)}%`);
  card.style.setProperty("--iqa-glow-opacity", "1");
};

const resetTilt = (event) => {
  const card = event.currentTarget;
  card.style.setProperty("--iqa-rotate-x", "0deg");
  card.style.setProperty("--iqa-rotate-y", "0deg");
  card.style.setProperty("--iqa-glow-x", "50%");
  card.style.setProperty("--iqa-glow-y", "50%");
  card.style.setProperty("--iqa-glow-opacity", "0");
};

const InsightList = ({ title, items, emptyText }) => (
  <div className="iqa-subcard">
    <p className="iqa-subcard-title">{title}</p>
    {items.length ? (
      <ul className="iqa-mini-list">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="iqa-muted-copy">{emptyText}</p>
    )}
  </div>
);

const FeedbackCard = ({ title, items, icon, tone, emptyText }) => (
  <div className={`iqa-subcard iqa-feedback-card ${tone}`}>
    <div className="iqa-feedback-head">
      <span className="iqa-feedback-icon">{icon}</span>
      <p className="iqa-subcard-title">{title}</p>
    </div>
    {items.length ? (
      <ul className="iqa-mini-list">
        {items.map((item) => (
          <li key={`${title}-${item}`}>{item}</li>
        ))}
      </ul>
    ) : (
      <p className="iqa-muted-copy">{emptyText}</p>
    )}
  </div>
);

const InterviewQAGenerator = () => {
  const [resumeFile, setResumeFile] = useState(null);
  const [difficulty, setDifficulty] = useState("medium");
  const [resolvedRole, setResolvedRole] = useState("");
  const [resumeContext, setResumeContext] = useState(null);
  const [questionPackMeta, setQuestionPackMeta] = useState({
    packSummary: "",
    focusAreas: [],
  });
  const [questions, setQuestions] = useState([]);
  const [questionHistory, setQuestionHistory] = useState([]);
  const [questionBatch, setQuestionBatch] = useState(0);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [questionRequestMode, setQuestionRequestMode] = useState("");
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const currentQuestion =
    questions.find((item) => item.id === selectedQuestionId) || null;

  const resolvedRoleLabel =
    resumeContext?.inferredRoleLabel ||
    (resolvedRole ? formatLabel(resolvedRole) : "Auto-detected");

  const patchQuestion = (questionId, updates) => {
    setQuestions((previous) =>
      previous.map((item) =>
        item.id === questionId ? { ...item, ...updates } : item,
      ),
    );
  };

  const clearQuestionSession = () => {
    setQuestions([]);
    setQuestionHistory([]);
    setQuestionBatch(0);
    setSelectedQuestionId("");
    setQuestionPackMeta({ packSummary: "", focusAreas: [] });
  };

  const handleResumeChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setPageError("");
    setNotice("");
    setResumeContext(null);
    setResolvedRole("");
    clearQuestionSession();

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

  const requestQuestionBatch = async ({ nextBatch = false } = {}) => {
    if (!resumeFile) {
      setPageError("Upload your resume PDF first.");
      return;
    }

    try {
      setQuestionRequestMode(nextBatch ? "next" : "fresh");
      setGeneratingQuestions(true);
      setPageError("");
      setNotice("");

      const data = await generateInterviewQuestions({
        resumeFile,
        difficulty,
        excludeQuestions: questionHistory,
      });

      const nextQuestions = Array.isArray(data?.questions)
        ? data.questions.map((item) => createQuestionState(item))
        : [];
      const nextQuestionTexts = nextQuestions
        .map((item) => item.question)
        .filter(Boolean);

      setResumeContext(data?.profile || null);
      setQuestionPackMeta({
        packSummary: data?.packSummary || "",
        focusAreas: Array.isArray(data?.focusAreas) ? data.focusAreas : [],
      });
      setResolvedRole(data?.role || data?.profile?.inferredRole || "");
      setNotice(data?.warning || "");

      if (!nextQuestions.length) {
        setPageError(
          nextBatch
            ? "No new questions were generated for the next batch yet."
            : "No questions were generated from this resume yet.",
        );
        return;
      }

      setQuestions(nextQuestions);
      setSelectedQuestionId(nextQuestions[0]?.id || "");
      setQuestionHistory((previous) =>
        [...new Set([...previous, ...nextQuestionTexts])],
      );
      setQuestionBatch((previous) => (nextBatch ? previous + 1 : 1));
    } catch (error) {
      setPageError(
        error?.response?.data?.message ||
          "Unable to generate interview questions right now.",
      );
    } finally {
      setGeneratingQuestions(false);
      setQuestionRequestMode("");
    }
  };

  const handleGenerateQuestions = async () => {
    await requestQuestionBatch({ nextBatch: false });
  };

  const handleNextQuestions = async () => {
    if (!questions.length) {
      setPageError("Generate the first 10 questions before requesting the next set.");
      return;
    }

    await requestQuestionBatch({ nextBatch: true });
  };

  const requestAnswer = async (questionItem, regenerate = false) => {
    if (!questionItem?.question) {
      return;
    }

    try {
      patchQuestion(questionItem.id, {
        answerLoading: true,
        answerRequested: true,
        followUp: regenerate ? null : questionItem.followUp,
      });
      setPageError("");

      const data = await generateInterviewAnswer({
        question: questionItem.question,
        role: resolvedRole || questionItem.role || "",
        difficulty,
        focusArea: questionItem.focusArea,
        questionType: questionItem.questionType,
        personalization: questionItem.personalization,
        previousAnswers:
          regenerate && questionItem.answer ? [questionItem.answer] : [],
        resumeSummary: resumeContext?.resumeSummary || "",
        resumeSkills: resumeContext?.resumeSkills || [],
        projects: resumeContext?.projects || "",
        experience: resumeContext?.experience || "",
      });

      patchQuestion(questionItem.id, {
        answer: data?.answer || "",
        highlights: Array.isArray(data?.highlights) ? data.highlights : [],
        answerFramework: Array.isArray(data?.answerFramework)
          ? data.answerFramework
          : [],
        answerHook: data?.answerHook || "",
        deliveryTips: Array.isArray(data?.deliveryTips) ? data.deliveryTips : [],
        pitfalls: Array.isArray(data?.pitfalls) ? data.pitfalls : [],
        answerLoading: false,
        answerRequested: true,
      });

      if (data?.warning) {
        setNotice(data.warning);
      }
    } catch (error) {
      patchQuestion(questionItem.id, {
        answerLoading: false,
        answerRequested: true,
      });
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
        role: resolvedRole || currentQuestion.role || "",
        difficulty,
        resumeSummary: resumeContext?.resumeSummary || "",
        resumeSkills: resumeContext?.resumeSkills || [],
        projects: resumeContext?.projects || "",
        experience: resumeContext?.experience || "",
      });

      patchQuestion(currentQuestion.id, {
        feedbackLoading: false,
        feedback: {
          strengths: Array.isArray(data?.strengths) ? data.strengths : [],
          weaknesses: Array.isArray(data?.weaknesses) ? data.weaknesses : [],
          improvedAnswer: data?.improvedAnswer || "",
          verdict: data?.verdict || "",
          score: Number(data?.score ?? 0) || 0,
          improvementPlan: Array.isArray(data?.improvementPlan)
            ? data.improvementPlan
            : [],
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
      setPageError("Select a question with an answer first.");
      return;
    }

    try {
      patchQuestion(currentQuestion.id, { followUpLoading: true });
      setPageError("");

      const data = await generateInterviewFollowUp({
        question: currentQuestion.question,
        userAnswer: currentQuestion.userAnswer.trim() || currentQuestion.answer,
        role: resolvedRole || currentQuestion.role || "",
        difficulty,
        resumeSummary: resumeContext?.resumeSummary || "",
        resumeSkills: resumeContext?.resumeSkills || [],
        projects: resumeContext?.projects || "",
        experience: resumeContext?.experience || "",
      });

      patchQuestion(currentQuestion.id, {
        followUpLoading: false,
        followUp: {
          question: data?.followUpQuestion || "",
          reason: data?.reason || "",
          whatToCover: Array.isArray(data?.whatToCover) ? data.whatToCover : [],
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

    if (
      !selected ||
      selected.answer ||
      selected.answerLoading ||
      selected.answerRequested
    ) {
      return;
    }

    void requestAnswer(selected);
  }, [questions, selectedQuestionId, difficulty, resolvedRole, resumeContext]);

  return (
    <div className="page-shell interview-qa-shell">
      <div className="interview-qa-backdrop" aria-hidden="true">
        <div className="interview-qa-orb interview-qa-orb-a" />
        <div className="interview-qa-orb interview-qa-orb-b" />
        <ParticleMesh className="interview-qa-mesh" />
      </div>

      <div className="page-inner interview-qa-page">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card interview-qa-top"
        >
          <div className="interview-qa-top__head">
            <div>
              <p className="interview-qa-eyebrow">Interview Q&A Generator</p>
              <h1 className="section-title interview-qa-title">
                Resume-Based Question And Answer
              </h1>
            </div>

            <div className="interview-qa-overview">
              <OverviewChip
                icon={<BrainCircuit size={14} />}
                label="Track"
                value={resolvedRoleLabel}
              />
              <OverviewChip
                icon={<Layers3 size={14} />}
                label="Questions"
                value={`${questions.length}/${QUESTION_BATCH_SIZE}`}
              />
              <OverviewChip
                icon={<FileText size={14} />}
                label="Difficulty"
                value={formatLabel(difficulty)}
              />
            </div>
          </div>

          <div className="interview-qa-top__controls">
            <div
              className="interview-qa-control qa-tilt-card"
              onPointerMove={handleTiltMove}
              onPointerLeave={resetTilt}
            >
              <div className="interview-qa-control__head">
                <span className="interview-qa-control__label">Resume PDF</span>
                <Upload size={14} />
              </div>

              <label className="interview-qa-upload">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleResumeChange}
                />
                <span className="interview-qa-upload__name">
                  {resumeFile?.name ||
                    resumeContext?.resumeFilename ||
                    "Choose resume file"}
                </span>
              </label>
            </div>

            <div
              className="interview-qa-control qa-tilt-card"
              onPointerMove={handleTiltMove}
              onPointerLeave={resetTilt}
            >
              <div className="interview-qa-control__head">
                <span className="interview-qa-control__label">Difficulty</span>
                <Sparkles size={14} />
              </div>

              <div className="interview-qa-difficulty-row">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`interview-qa-difficulty ${
                      difficulty === option ? "is-active" : ""
                    }`}
                    onClick={() => {
                      setDifficulty(option);
                      setPageError("");
                      setNotice("");
                      clearQuestionSession();
                    }}
                  >
                    {formatLabel(option)}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateQuestions}
              disabled={generatingQuestions}
              className="btn-primary interview-qa-generate"
            >
              {generatingQuestions && questionRequestMode !== "next" ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Building Pack...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Generate Pack
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNextQuestions}
              disabled={generatingQuestions || !questions.length}
              className="btn-ghost interview-qa-next"
            >
              {generatingQuestions && questionRequestMode === "next" ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Loading Next...
                </>
              ) : (
                <>
                  <ArrowRight size={14} />
                  Next 10
                </>
              )}
            </button>
          </div>

          {resumeContext ? (
            <div className="interview-qa-resume-strip">
              {questionBatch ? (
                <span className="interview-qa-meta-pill">
                  Batch {questionBatch}
                </span>
              ) : null}
              <span className="interview-qa-meta-pill">
                {resumeContext.resumeFilename || resumeFile?.name || "Resume ready"}
              </span>
              {(resumeContext.resumeSkills || []).slice(0, 6).map((skill) => (
                <span key={skill} className="interview-qa-skill-pill">
                  {skill}
                </span>
              ))}
            </div>
          ) : null}

          {questionPackMeta.packSummary ? (
            <div className="interview-qa-pack-summary">
              <p>{questionPackMeta.packSummary}</p>
              {questionPackMeta.focusAreas.length ? (
                <div className="interview-qa-pack-summary__chips">
                  {questionPackMeta.focusAreas.map((item) => (
                    <span key={item} className="interview-qa-meta-pill">
                      {formatLabel(item)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {pageError ? (
            <p className="interview-qa-message is-error">{pageError}</p>
          ) : null}
          {notice ? <p className="interview-qa-message is-note">{notice}</p> : null}
        </motion.section>

        <section className="interview-qa-grid">
          <aside
            className="glass-card interview-qa-questions"
          >
            <div className="interview-qa-panel-head">
              <div>
                <p className="interview-qa-panel-kicker">Questions</p>
                <h2 className="interview-qa-panel-title">
                  {questionBatch ? `Batch ${questionBatch}` : "Generated Set"}
                </h2>
              </div>
              <span className="interview-qa-count-pill">{questions.length}</span>
            </div>

            <div className="interview-qa-question-list">
              {questions.length ? (
                questions.map((item, index) => {
                  const active = item.id === selectedQuestionId;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedQuestionId(item.id)}
                      className={`interview-qa-question-card ${
                        active ? "is-active" : ""
                      }`}
                    >
                      <div className="interview-qa-question-card__meta">
                        <span className="interview-qa-question-card__count">
                          Q{index + 1}
                        </span>
                        <span className="interview-qa-question-card__type">
                          {formatLabel(item.questionType || "Question")}
                        </span>
                      </div>

                      <p className="interview-qa-question-card__title">
                        {item.question}
                      </p>

                      <div className="interview-qa-question-card__foot">
                        <span>{formatLabel(item.focusArea || "Resume")}</span>
                        <span>
                          {item.answerLoading
                            ? "Generating"
                            : item.answer
                              ? "Answer Ready"
                              : "Select to load"}
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="interview-qa-empty">
                  Upload your resume and generate a pack to populate this list.
                </div>
              )}
            </div>
          </aside>

          <div className="interview-qa-workspace">
            <section
              className="glass-card interview-qa-answer"
            >
              {currentQuestion ? (
                <div className="interview-qa-answer__content">
                  <div className="interview-qa-panel-head">
                    <div className="interview-qa-chip-row">
                      <span className="badge">{resolvedRoleLabel}</span>
                      <span className="badge">
                        {formatLabel(currentQuestion.difficulty || difficulty)}
                      </span>
                      {currentQuestion.questionType ? (
                        <span className="badge">
                          {formatLabel(currentQuestion.questionType)}
                        </span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => requestAnswer(currentQuestion, true)}
                      disabled={currentQuestion.answerLoading}
                      className="btn-ghost interview-qa-mini-btn"
                    >
                      {currentQuestion.answerLoading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Refreshing
                        </>
                      ) : (
                        <>
                          <RefreshCcw size={14} />
                          Refresh Answer
                        </>
                      )}
                    </button>
                  </div>

                  <h2 className="interview-qa-question-title">
                    {currentQuestion.question}
                  </h2>

                  {currentQuestion.interviewerIntent ? (
                    <div className="interview-qa-intent">
                      <span className="interview-qa-intent__label">Interviewer Intent</span>
                      <p>{currentQuestion.interviewerIntent}</p>
                    </div>
                  ) : null}

                  {currentQuestion.personalization ? (
                    <p className="interview-qa-personalization">
                      {currentQuestion.personalization}
                    </p>
                  ) : null}

                  <div className="interview-qa-answer-box">
                    {currentQuestion.answerHook ? (
                      <div className="interview-qa-answer-hook">
                        <span>Strong opening</span>
                        <p>{currentQuestion.answerHook}</p>
                      </div>
                    ) : null}
                    {currentQuestion.answerLoading ? (
                      <div className="interview-qa-loading">
                        <Loader2 size={16} className="animate-spin" />
                        Generating a stronger answer...
                      </div>
                    ) : currentQuestion.answer ? (
                      <p className="interview-qa-answer-text">
                        {currentQuestion.answer}
                      </p>
                    ) : (
                      <p className="iqa-muted-copy">
                        Select a question to load its answer.
                      </p>
                    )}
                  </div>

                  <div className="interview-qa-insights">
                    <InsightList
                      title="Key Points"
                      items={currentQuestion.highlights}
                      emptyText="Key answer signals will appear here."
                    />
                    <InsightList
                      title="Answer Flow"
                      items={currentQuestion.answerFramework}
                      emptyText="Answer structure will appear here."
                    />
                    <InsightList
                      title="What Impresses"
                      items={currentQuestion.strongSignals}
                      emptyText="Interviewer signals will appear here."
                    />
                    <InsightList
                      title="Avoid These"
                      items={currentQuestion.redFlags}
                      emptyText="Common pitfalls will appear here."
                    />
                    <InsightList
                      title="Delivery Tips"
                      items={currentQuestion.deliveryTips}
                      emptyText="Delivery tips will appear here."
                    />
                    <InsightList
                      title="Watch Outs"
                      items={currentQuestion.pitfalls}
                      emptyText="Pitfalls will appear here."
                    />
                  </div>

                  <div className="iqa-subcard interview-qa-follow-up">
                    <div className="interview-qa-follow-up__head">
                      <div>
                        <p className="iqa-subcard-title">Follow-up</p>
                        <p className="iqa-muted-copy">
                          Deeper interviewer push
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleFollowUp}
                        disabled={currentQuestion.followUpLoading}
                        className="btn-ghost interview-qa-mini-btn"
                      >
                        {currentQuestion.followUpLoading ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Thinking
                          </>
                        ) : (
                          <>
                            <MessageCircleMore size={14} />
                            Ask
                          </>
                        )}
                      </button>
                    </div>

                    {currentQuestion.followUp?.question ? (
                      <div className="interview-qa-follow-up__body">
                        <p className="interview-qa-follow-up__question">
                          {currentQuestion.followUp.question}
                        </p>
                        {currentQuestion.followUp.reason ? (
                          <p className="iqa-muted-copy">
                            {currentQuestion.followUp.reason}
                          </p>
                        ) : null}
                        {currentQuestion.followUp?.whatToCover?.length ? (
                          <ul className="iqa-mini-list">
                            {currentQuestion.followUp.whatToCover.map((item) => (
                              <li key={`follow-up-${item}`}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : (
                      <p className="iqa-muted-copy">
                        Generate a deeper follow-up when you want to practice beyond
                        the model answer.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="interview-qa-empty interview-qa-empty--large">
                  Generate a pack and select a question to open the answer studio.
                </div>
              )}
            </section>

            <section
              className="glass-card interview-qa-practice"
            >
              <div className="interview-qa-panel-head">
                <div>
                  <p className="interview-qa-panel-kicker">Practice</p>
                  <h2 className="interview-qa-panel-title">Your Answer Review</h2>
                </div>
                {currentQuestion?.feedback?.score ? (
                  <span className="interview-qa-score-pill">
                    {currentQuestion.feedback.score}/100
                  </span>
                ) : null}
              </div>

              <label className="interview-qa-textarea-wrap">
                <span className="interview-qa-control__label">Your Answer</span>
                <textarea
                  value={currentQuestion?.userAnswer || ""}
                  onChange={(event) =>
                    currentQuestion &&
                    patchQuestion(currentQuestion.id, {
                      userAnswer: event.target.value,
                    })
                  }
                  disabled={!currentQuestion}
                  rows={8}
                  className="textarea interview-qa-textarea"
                  placeholder="Write your answer for the selected question..."
                />
              </label>

              <button
                type="button"
                onClick={handleGetFeedback}
                disabled={!currentQuestion || currentQuestion.feedbackLoading}
                className="btn-primary interview-qa-review-btn"
              >
                {currentQuestion?.feedbackLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Reviewing...
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    Review Answer
                  </>
                )}
              </button>

              <div className="interview-qa-feedback-grid">
                <FeedbackCard
                  title="Strengths"
                  items={currentQuestion?.feedback?.strengths || []}
                  icon={<ThumbsUp size={14} />}
                  tone="is-positive"
                  emptyText="Strengths appear after feedback."
                />
                <FeedbackCard
                  title="Weaknesses"
                  items={currentQuestion?.feedback?.weaknesses || []}
                  icon={<ThumbsDown size={14} />}
                  tone="is-negative"
                  emptyText="Weak points appear after feedback."
                />
              </div>

              <div className="iqa-subcard interview-qa-improved">
                <div className="interview-qa-follow-up__head">
                  <div>
                    <p className="iqa-subcard-title">Improved Answer</p>
                    <p className="iqa-muted-copy">
                      {currentQuestion?.feedback?.verdict ||
                        "A polished rewrite appears after feedback."}
                    </p>
                  </div>
                </div>

                {currentQuestion?.feedback?.improvedAnswer ? (
                  <p className="interview-qa-answer-text">
                    {currentQuestion.feedback.improvedAnswer}
                  </p>
                ) : (
                  <p className="iqa-muted-copy">
                    Review your answer to generate the improved version.
                  </p>
                )}
              </div>

              <div className="iqa-subcard interview-qa-improved">
                <div className="interview-qa-follow-up__head">
                  <div>
                    <p className="iqa-subcard-title">Improvement Plan</p>
                    <p className="iqa-muted-copy">
                      The highest-impact changes for the next attempt.
                    </p>
                  </div>
                </div>

                {currentQuestion?.feedback?.improvementPlan?.length ? (
                  <ul className="iqa-mini-list">
                    {currentQuestion.feedback.improvementPlan.map((item) => (
                      <li key={`improvement-${item}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="iqa-muted-copy">
                    Review your answer to get a focused improvement plan.
                  </p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
};

const OverviewChip = ({ icon, label, value }) => (
  <div className="interview-qa-overview-chip">
    <span className="interview-qa-overview-chip__icon">{icon}</span>
    <div>
      <p className="interview-qa-overview-chip__label">{label}</p>
      <p className="interview-qa-overview-chip__value">{value}</p>
    </div>
  </div>
);

export default InterviewQAGenerator;
