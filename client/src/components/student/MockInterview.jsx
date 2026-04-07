import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Mic,
  ShieldCheck,
  Video,
  Volume2,
  XCircle,
} from "lucide-react";

import InterviewCore from "./InterviewCore";
import { startMockInterview } from "../../services/interviewQaApi.jsx";


const ROLE_OPTIONS = ["frontend", "backend", "full stack"];
const ENGLISH_OPTIONS = ["basic", "medium", "advanced"];
const DIFFICULTY_OPTIONS = ["easy", "medium", "hard"];
const QUESTION_COUNT_OPTIONS = [4, 5, 6];

const formatLabel = (value = "") =>
  value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const stopMediaStream = (stream) => {
  stream?.getTracks?.().forEach((track) => track.stop());
};

const DeviceRow = ({ icon, title, description, status, action }) => (
  <div className="flex flex-wrap items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-slate-950/25 p-4">
    <div className="flex items-start gap-3">
      <div className="rounded-2xl bg-white/8 p-3">{icon}</div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-50">{title}</p>
        <p className="text-sm leading-6 text-slate-400">{description}</p>
      </div>
    </div>

    <div className="flex items-center gap-3">
      <div
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
          status === "ready"
            ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100"
            : status === "warning"
              ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
              : "border-rose-300/30 bg-rose-400/10 text-rose-100"
        }`}
      >
        {status === "ready" ? (
          <CheckCircle2 size={14} />
        ) : status === "warning" ? (
          <AlertTriangle size={14} />
        ) : (
          <XCircle size={14} />
        )}
        {status === "ready"
          ? "Ready"
          : status === "warning"
            ? "Needs check"
            : "Not ready"}
      </div>
      {action}
    </div>
  </div>
);

const MockInterview = () => {
  const previewVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micFrameRef = useRef(null);
  const lastMeasuredMicLevelRef = useRef(0);

  const [resumeFile, setResumeFile] = useState(null);
  const [role, setRole] = useState("full stack");
  const [englishLevel, setEnglishLevel] = useState("medium");
  const [difficulty, setDifficulty] = useState("medium");
  const [totalQuestions, setTotalQuestions] = useState(5);
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const [speakerConfirmed, setSpeakerConfirmed] = useState(false);
  const [preparingInterview, setPreparingInterview] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [notice, setNotice] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [mediaStream, setMediaStream] = useState(null);
  const [session, setSession] = useState(null);
  const [deviceState, setDeviceState] = useState({
    browserReady:
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia),
    speechSynthesisReady:
      typeof window !== "undefined" && "speechSynthesis" in window,
    speechRecognitionReady:
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    cameraReady: false,
    microphoneReady: false,
    permissionsRequested: false,
  });

  const stopAudioMonitor = () => {
    if (micFrameRef.current) {
      cancelAnimationFrame(micFrameRef.current);
      micFrameRef.current = null;
    }

    analyserRef.current = null;

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    lastMeasuredMicLevelRef.current = 0;
    setMicLevel(0);
  };

  const startAudioMonitor = (stream) => {
    stopAudioMonitor();

    const AudioContextCtor =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextCtor) {
      setDeviceState((previous) => ({
        ...previous,
        microphoneReady: Boolean(stream.getAudioTracks().length),
      }));
      return;
    }

    const audioContext = new AudioContextCtor();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 256;
    source.connect(analyser);

    const samples = new Uint8Array(analyser.frequencyBinCount);
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    const tick = () => {
      analyser.getByteFrequencyData(samples);
      const average =
        samples.reduce((sum, item) => sum + item, 0) /
        Math.max(samples.length, 1);
      const normalizedLevel = average / 255;

      lastMeasuredMicLevelRef.current = normalizedLevel;
      setMicLevel(normalizedLevel);

      if (normalizedLevel > 0.03) {
        setDeviceState((previous) => ({
          ...previous,
          microphoneReady: true,
        }));
      }

      micFrameRef.current = requestAnimationFrame(tick);
    };

    audioContext.resume().catch(() => {});
    tick();
  };

  const attachPreview = async (stream) => {
    if (!previewVideoRef.current || !stream) {
      return;
    }

    previewVideoRef.current.srcObject = stream;

    try {
      await previewVideoRef.current.play();
    } catch {
      // Ignore autoplay issues; the stream is still available.
    }
  };

  const refreshPermissionHints = async () => {
    if (!navigator.permissions?.query) {
      return;
    }

    try {
      const [cameraPermission, microphonePermission] = await Promise.all([
        navigator.permissions.query({ name: "camera" }),
        navigator.permissions.query({ name: "microphone" }),
      ]);

      setNotice(
        `Camera permission: ${cameraPermission.state}. Microphone permission: ${microphonePermission.state}.`,
      );
    } catch {
      // Permission query support is browser-dependent.
    }
  };

  const requestPermissions = async () => {
    if (!deviceState.browserReady) {
      setSetupError(
        "This browser does not support camera and microphone access for the mock interview.",
      );
      return;
    }

    try {
      setSetupError("");
      setNotice("");

      const nextStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      stopMediaStream(mediaStream);
      setMediaStream(nextStream);
      setDeviceState((previous) => ({
        ...previous,
        permissionsRequested: true,
        cameraReady: Boolean(nextStream.getVideoTracks().length),
        microphoneReady: Boolean(nextStream.getAudioTracks().length),
      }));
      setNotice(
        "Camera and microphone access granted. Say a few words to confirm the mic meter is moving, then run the speaker test.",
      );

      await attachPreview(nextStream);
      startAudioMonitor(nextStream);
      await refreshPermissionHints();
    } catch (error) {
      setSetupError(
        error?.message ||
          "Unable to access camera and microphone. Please allow both permissions and try again.",
      );
    }
  };

  const playSpeakerSample = () => {
    if (!deviceState.speechSynthesisReady) {
      setSetupError(
        "Speech playback is not supported in this browser, so the speaker test cannot run here.",
      );
      return;
    }

    setSetupError("");
    setNotice("Listen for the sample voice, then confirm that you heard it.");
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(
      "This is your mock interview speaker test. If you can hear this clearly, confirm the sound check and start the interview.",
    );
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleResumeChange = (event) => {
    const nextFile = event.target.files?.[0] || null;
    setSetupError("");

    if (!nextFile) {
      setResumeFile(null);
      return;
    }

    const isPdf =
      nextFile.type === "application/pdf" ||
      nextFile.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setResumeFile(null);
      setSetupError("Please upload a PDF resume only.");
      return;
    }

    setResumeFile(nextFile);
  };

  const handleStartInterview = async () => {
    if (!resumeFile) {
      setSetupError("Upload your resume PDF first.");
      return;
    }

    if (!mediaStream) {
      setSetupError("Enable your camera and microphone before starting.");
      return;
    }

    if (!speakerConfirmed) {
      setSetupError("Complete the speaker test confirmation before starting.");
      return;
    }

    if (!rulesAccepted) {
      setSetupError("Accept the interview rules and proctoring instructions first.");
      return;
    }

    try {
      setPreparingInterview(true);
      setSetupError("");
      setNotice("");

      const data = await startMockInterview({
        resumeFile,
        role,
        difficulty,
        englishLevel,
        totalQuestions,
      });

      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }

      setSession({
        role,
        difficulty,
        englishLevel,
        totalQuestions: Number(data?.totalQuestions ?? totalQuestions) || totalQuestions,
        opening: data?.opening || "",
        question: data?.question || "",
        interviewerStyle: data?.interviewerStyle || "",
        profile: data?.profile || null,
        warning: data?.warning || "",
      });
      setNotice(data?.warning || "");
    } catch (error) {
      setSetupError(
        error?.response?.data?.message ||
          "Unable to start the mock interview right now.",
      );
    } finally {
      setPreparingInterview(false);
    }
  };

  const readyToStart =
    resumeFile &&
    rulesAccepted &&
    mediaStream &&
    speakerConfirmed &&
    deviceState.browserReady;

  useEffect(() => {
    if (mediaStream) {
      void attachPreview(mediaStream);
    }
  }, [mediaStream]);

  useEffect(() => () => {
    stopAudioMonitor();
    stopMediaStream(mediaStream);
    window.speechSynthesis?.cancel?.();
  }, [mediaStream]);

  if (session) {
    return (
      <InterviewCore
        initialSession={session}
        mediaStream={mediaStream}
        onRestart={() => {
          setSession(null);
          setNotice("");
        }}
      />
    );
  }

  return (
    <div className="page-shell">
      <div className="page-inner max-w-[1380px] space-y-6">
        <section className="glass-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                Mock Interview
              </p>
              <h1 className="section-title">
                Upload your resume, verify your interview setup, then start a
                resume-aware face-to-face mock interview.
              </h1>
              <p className="text-sm leading-7 text-slate-300">
                The interviewer uses your resume, role, English level, and
                difficulty to ask realistic questions and deeper follow-ups.
                During the interview, the app tracks device readiness,
                fullscreen exit, tab switches, and camera presence signals.
              </p>
            </div>

            <div className="rounded-[22px] border border-cyan-300/25 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
              {deviceState.speechRecognitionReady
                ? "Voice answer mode available"
                : "Voice typing unavailable in this browser. Text answers still work."}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_220px_220px_220px_180px]">
            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Resume PDF</span>
              <div className="rounded-[18px] border border-dashed border-white/14 bg-slate-950/25 p-4">
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleResumeChange}
                  className="input border-0 bg-transparent px-0 py-0 shadow-none file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-400/15 file:px-4 file:py-2 file:font-semibold file:text-cyan-100"
                />
                <div className="mt-3 flex items-center gap-3 text-sm text-slate-300">
                  <FileText size={16} className="text-cyan-200" />
                  {resumeFile ? resumeFile.name : "Upload your resume to personalize the interview"}
                </div>
              </div>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Role</span>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="select"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">English Level</span>
              <select
                value={englishLevel}
                onChange={(event) => setEnglishLevel(event.target.value)}
                className="select"
              >
                {ENGLISH_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Interview Level</span>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value)}
                className="select"
              >
                {DIFFICULTY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatLabel(option)}
                  </option>
                ))}
              </select>
            </label>

            <label className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <span className="input-label">Questions</span>
              <select
                value={totalQuestions}
                onChange={(event) => setTotalQuestions(Number(event.target.value))}
                className="select"
              >
                {QUESTION_COUNT_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {setupError ? (
            <p className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {setupError}
            </p>
          ) : null}

          {notice ? (
            <p className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              {notice}
            </p>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_420px]">
          <div className="space-y-6">
            <section className="glass-card p-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Rules &amp; Instructions
                </p>
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-50">
                  Read this before you begin
                </h2>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  "Keep your face inside the camera frame for the whole interview.",
                  "Stay on the interview tab and keep the window in fullscreen mode.",
                  "Do not copy, paste, switch tabs, or use outside help during the session.",
                  "Answer naturally in your own words and use examples from your work.",
                ].map((item) => (
                  <div
                    key={item}
                    className="rounded-[20px] border border-white/10 bg-slate-950/25 p-4 text-sm leading-7 text-slate-300"
                  >
                    {item}
                  </div>
                ))}
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-[20px] border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm leading-7 text-emerald-50">
                <input
                  type="checkbox"
                  checked={rulesAccepted}
                  onChange={(event) => setRulesAccepted(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-emerald-200/50 bg-transparent"
                />
                <span>
                  I understand the rules, consent to camera and attention
                  checks during the practice interview, and want to continue.
                </span>
              </label>
            </section>

            <section className="glass-card p-6">
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                  Device Check
                </p>
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-50">
                  Verify camera, mic, and sound before starting
                </h2>
              </div>

              <div className="mt-5 space-y-4">
                <DeviceRow
                  icon={<Video size={18} className="text-cyan-200" />}
                  title="Camera & microphone access"
                  description="The interview requires both permissions so the preview, voice input, and proctoring checks can run."
                  status={
                    deviceState.cameraReady && deviceState.permissionsRequested
                      ? "ready"
                      : deviceState.permissionsRequested
                        ? "warning"
                        : "error"
                  }
                  action={(
                    <button
                      type="button"
                      onClick={requestPermissions}
                      className="btn-secondary"
                    >
                      Enable
                    </button>
                  )}
                />

                <DeviceRow
                  icon={<Mic size={18} className="text-emerald-200" />}
                  title="Microphone activity"
                  description="Say a few words and confirm the live meter responds. Text input remains available if voice typing is unsupported."
                  status={
                    deviceState.microphoneReady
                      ? "ready"
                      : mediaStream
                        ? "warning"
                        : "error"
                  }
                  action={(
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                      <span className="h-2.5 w-20 overflow-hidden rounded-full bg-slate-800">
                        <span
                          className="block h-full rounded-full bg-emerald-300 transition-all"
                          style={{ width: `${Math.min(100, micLevel * 260)}%` }}
                        />
                      </span>
                      Live
                    </div>
                  )}
                />

                <DeviceRow
                  icon={<Volume2 size={18} className="text-orange-200" />}
                  title="Speaker test"
                  description="Play the sample voice and confirm that you can hear the interviewer clearly."
                  status={speakerConfirmed ? "ready" : "error"}
                  action={(
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={playSpeakerSample}
                        className="btn-ghost"
                      >
                        Play Sample
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeakerConfirmed(true)}
                        className="btn-secondary"
                      >
                        I Heard It
                      </button>
                    </div>
                  )}
                />

                <DeviceRow
                  icon={<ShieldCheck size={18} className="text-purple-200" />}
                  title="Interview browser support"
                  description="Camera/mic access is required. Voice typing is optional because typed answers are always available as fallback."
                  status={deviceState.browserReady ? "ready" : "error"}
                  action={(
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
                      {deviceState.speechRecognitionReady
                        ? "Voice typing supported"
                        : "Typing only mode"}
                    </div>
                  )}
                />
              </div>
            </section>
          </div>

          <section className="glass-card p-6">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">
                Live Preview
              </p>
              <h2 className="font-['Sora'] text-2xl font-semibold text-slate-50">
                Check your frame before the interview starts
              </h2>
              <p className="text-sm leading-7 text-slate-300">
                Keep your head and shoulders visible. A very dark frame,
                missing face signals, fullscreen exit, or tab switches will be
                flagged during the interview.
              </p>
            </div>

            <div className="mt-5 overflow-hidden rounded-[26px] border border-white/10 bg-slate-950/40">
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="aspect-video w-full bg-slate-950 object-cover"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="badge">
                {resumeFile ? "Resume ready" : "Resume pending"}
              </span>
              <span className="badge">
                {mediaStream ? "Camera connected" : "Camera pending"}
              </span>
              <span className="badge">
                {speakerConfirmed ? "Speaker checked" : "Speaker pending"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleStartInterview}
              disabled={!readyToStart || preparingInterview}
              className="btn-primary mt-6 w-full"
            >
              {preparingInterview ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Starting Interview...
                </>
              ) : (
                "Start Mock Interview"
              )}
            </button>
          </section>
        </section>
      </div>
    </div>
  );
};

export default MockInterview;
