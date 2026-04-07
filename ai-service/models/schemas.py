from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
    resume_text: str = Field(..., min_length=1)
    job_description: str = Field(..., min_length=1)


class JobRequest(BaseModel):
    job_title: str = Field(..., min_length=2)
    company: str = Field(..., min_length=2)
    company_overview: Optional[str] = ""
    employment_type: Optional[str] = ""
    work_mode: Optional[str] = ""
    location: Optional[str] = ""
    department: Optional[str] = ""
    experience_level: Optional[str] = ""
    skills: list[str] = Field(default_factory=list)
    good_to_have: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    benefits: list[str] = Field(default_factory=list)
    current_description: Optional[str] = ""
    improvement_instructions: Optional[str] = ""


class ChatHistoryItem(BaseModel):
    role: str = Field(..., min_length=1)
    content: str = Field(..., min_length=1)


class ChatStudentProfileContext(BaseModel):
    fullname: Optional[str] = ""
    branch: Optional[str] = ""
    cgpa: Optional[float] = None
    graduation_year: Optional[int] = None
    placement_status: Optional[str] = ""
    skills: list[str] = Field(default_factory=list)
    internships: Optional[str] = ""
    projects: Optional[str] = ""
    github: Optional[str] = ""
    linkedin: Optional[str] = ""
    summary: Optional[str] = ""
    resume_available: bool = False


class ChatJobContext(BaseModel):
    job_id: Optional[str] = ""
    job_title: Optional[str] = ""
    company: Optional[str] = ""
    description: Optional[str] = ""
    skills: list[str] = Field(default_factory=list)
    location: Optional[str] = ""
    work_mode: Optional[str] = ""
    employment_type: Optional[str] = ""


class ChatResumeAnalysisContext(BaseModel):
    final_score: Optional[float] = None
    keyword_score: Optional[float] = None
    semantic_score: Optional[float] = None
    resume_skills: list[str] = Field(default_factory=list)
    job_skills: list[str] = Field(default_factory=list)
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    skill_gap_percent: Optional[int] = None
    suggestions: list[str] = Field(default_factory=list)


class ChatRecommendationItem(BaseModel):
    job_id: Optional[str] = ""
    job_title: Optional[str] = ""
    company: Optional[str] = ""
    matched_skills: list[str] = Field(default_factory=list)
    match_count: Optional[int] = 0
    location: Optional[str] = ""
    employment_type: Optional[str] = ""
    source: Optional[str] = ""
    apply_url: Optional[str] = ""


class ChatContext(BaseModel):
    student_profile: Optional[ChatStudentProfileContext] = None
    active_job: Optional[ChatJobContext] = None
    resume_analysis: Optional[ChatResumeAnalysisContext] = None
    recommended_jobs: list[ChatRecommendationItem] = Field(default_factory=list)
    external_jobs: list[ChatRecommendationItem] = Field(default_factory=list)


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    history: list[ChatHistoryItem] = Field(default_factory=list)
    context: Optional[ChatContext] = None
    resume_skills: list[str] = Field(default_factory=list)
    top_k: int = Field(default=3, ge=1, le=6)


class ChatJobSuggestion(BaseModel):
    title: str = ""
    link: str = ""
    company: str = ""
    location: str = ""
    source: str = ""
    matched_skills: list[str] = Field(default_factory=list)
    reason: str = ""


class ChatResponse(BaseModel):
    answer: str
    intent: str = "general"
    suggestions: list[str] = Field(default_factory=list)
    confidence: float = 0.0
    jobs: list[ChatJobSuggestion] = Field(default_factory=list)
    matched_topics: list[str] = Field(default_factory=list)
    fallback_used: bool = False
    answer_mode: str = "fallback"
    context_flags: dict[str, Any] = Field(default_factory=dict)
    skill_gap: Optional[ChatResumeAnalysisContext] = None
    recommended_jobs: list[ChatRecommendationItem] = Field(default_factory=list)
    external_jobs: list[ChatRecommendationItem] = Field(default_factory=list)


class InterviewQuestionItem(BaseModel):
    id: str = ""
    question: str = Field(..., min_length=5)
    focus_area: str = ""
    question_type: str = ""
    difficulty: str = "medium"
    role: str = "full stack"
    personalization: str = ""


class GenerateQuestionsRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    projects: Optional[str] = ""
    experience: Optional[str] = ""
    resume_text: Optional[str] = ""
    resume_summary: Optional[str] = ""
    resume_skills: list[str] = Field(default_factory=list)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)
    exclude_questions: list[str] = Field(default_factory=list)
    count: int = Field(default=10, ge=4, le=12)


class GenerateQuestionsResponse(BaseModel):
    questions: list[InterviewQuestionItem] = Field(default_factory=list)
    role: str = "full stack"
    difficulty: str = "medium"
    profile_summary: str = ""
    fallback_used: bool = False


class GenerateAnswerRequest(BaseModel):
    question: str = Field(..., min_length=5)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)
    skills: list[str] = Field(default_factory=list)
    projects: Optional[str] = ""
    experience: Optional[str] = ""
    resume_text: Optional[str] = ""
    resume_summary: Optional[str] = ""
    resume_skills: list[str] = Field(default_factory=list)
    previous_answers: list[str] = Field(default_factory=list)


class GenerateAnswerResponse(BaseModel):
    answer: str
    highlights: list[str] = Field(default_factory=list)
    answer_framework: list[str] = Field(default_factory=list)
    fallback_used: bool = False


class EvaluateAnswerRequest(BaseModel):
    question: str = Field(..., min_length=5)
    user_answer: str = Field(..., min_length=5)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)


class EvaluateAnswerResponse(BaseModel):
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    improved_answer: str = ""
    verdict: str = ""
    score: int = Field(default=0, ge=0, le=100)
    fallback_used: bool = False


class FollowUpRequest(BaseModel):
    question: str = Field(..., min_length=5)
    user_answer: str = Field(..., min_length=5)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)


class FollowUpResponse(BaseModel):
    follow_up_question: str
    reason: str = ""
    fallback_used: bool = False


class MockInterviewHistoryItem(BaseModel):
    question: str = Field(..., min_length=5)
    answer: str = Field(default="")
    interviewer_reply: str = Field(default="")


class MockInterviewStartRequest(BaseModel):
    skills: list[str] = Field(default_factory=list)
    projects: Optional[str] = ""
    experience: Optional[str] = ""
    resume_text: Optional[str] = ""
    resume_summary: Optional[str] = ""
    resume_skills: list[str] = Field(default_factory=list)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)
    english_level: str = Field(default="medium", min_length=4)
    total_questions: int = Field(default=5, ge=3, le=8)


class MockInterviewStartResponse(BaseModel):
    opening: str
    first_question: str
    interviewer_style: str = ""
    role: str = "full stack"
    difficulty: str = "medium"
    english_level: str = "medium"
    total_questions: int = 5
    fallback_used: bool = False


class MockInterviewNextRequest(BaseModel):
    current_question: str = Field(..., min_length=5)
    user_answer: str = Field(..., min_length=3)
    history: list[MockInterviewHistoryItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: Optional[str] = ""
    experience: Optional[str] = ""
    resume_text: Optional[str] = ""
    resume_summary: Optional[str] = ""
    resume_skills: list[str] = Field(default_factory=list)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)
    english_level: str = Field(default="medium", min_length=4)
    question_index: int = Field(default=1, ge=1, le=20)
    total_questions: int = Field(default=5, ge=3, le=8)


class MockInterviewNextResponse(BaseModel):
    interviewer_reply: str
    next_question: str = ""
    should_end: bool = False
    closing_remark: str = ""
    focus_area: str = ""
    fallback_used: bool = False


class MockInterviewFinishRequest(BaseModel):
    history: list[MockInterviewHistoryItem] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    projects: Optional[str] = ""
    experience: Optional[str] = ""
    resume_text: Optional[str] = ""
    resume_summary: Optional[str] = ""
    resume_skills: list[str] = Field(default_factory=list)
    role: str = Field(default="full stack", min_length=2)
    difficulty: str = Field(default="medium", min_length=4)
    english_level: str = Field(default="medium", min_length=4)
    total_questions: int = Field(default=5, ge=3, le=8)
    proctor_flags: list[str] = Field(default_factory=list)


class MockInterviewFinishResponse(BaseModel):
    summary: str
    strengths: list[str] = Field(default_factory=list)
    improvements: list[str] = Field(default_factory=list)
    overall_score: int = Field(default=0, ge=0, le=100)
    communication_score: int = Field(default=0, ge=0, le=100)
    technical_score: int = Field(default=0, ge=0, le=100)
    confidence_score: int = Field(default=0, ge=0, le=100)
    integrity_note: str = ""
    fallback_used: bool = False
