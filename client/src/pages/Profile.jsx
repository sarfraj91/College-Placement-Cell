import { useEffect, useMemo, useRef, useState } from "react";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileText,
  GraduationCap,
  Link2,
  Mail,
  MapPin,
  PenSquare,
  Phone,
  Sparkles,
  Upload,
  User,
  X,
} from "lucide-react";
import API from "../services/api";
import useAuth from "../hooks/UseAuth";
import "./Profile.css";

const viewTabs = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "career", label: "Career & Links", icon: Briefcase },
];

const editSteps = [
  {
    id: "basic",
    title: "Basic Details",
    description: "Personal profile basics",
  },
  {
    id: "education",
    title: "Education",
    description: "Academic performance and scores",
  },
  {
    id: "details",
    title: "Personal Details",
    description: "Placement status and address",
  },
  {
    id: "links",
    title: "Social Link",
    description: "Skills, links, and documents",
  },
];

const documentFields = [
  { key: "resume", label: "Resume" },
  { key: "tenthMarksheet", label: "10th Marksheet" },
  { key: "twelthMarksheet", label: "12th Marksheet" },
  { key: "semesterMarksheet", label: "Semester Marksheet" },
  { key: "cocubes", label: "Cocubes Certificate" },
  { key: "amcat", label: "AMCAT Certificate" },
];

const defaultForm = {
  fullname: "",
  email: "",
  phone: "",
  gender: "",
  dob: "",
  rollNo: "",
  branch: "",
  batch: "",
  cgpa: "",
  graduationYear: "",
  backlogs: "",
  placementStatus: "unplaced",
  tenthPercent: "",
  twelthPercent: "",
  cocubesScore: "",
  amcatScore: "",
  skills: "",
  linkedin: "",
  github: "",
  internships: "",
  projects: "",
  district: "",
  state: "",
  country: "",
  pincode: "",
};

const buildFormState = (user = {}) => ({
  fullname: user.fullname ?? "",
  email: user.email ?? "",
  phone: user.phone ?? "",
  gender: user.gender ?? "",
  dob: user.dob ? String(user.dob).slice(0, 10) : "",
  rollNo: user.rollNo ?? "",
  branch: user.branch ?? "",
  batch: user.batch ?? "",
  cgpa: user.cgpa ?? "",
  graduationYear: user.graduationYear ?? "",
  backlogs: user.backlogs ?? "",
  placementStatus: user.placementStatus ?? "unplaced",
  tenthPercent: user.tenthPercent ?? "",
  twelthPercent: user.twelthPercent ?? user.twelfthPercent ?? "",
  cocubesScore: user.cocubesScore ?? "",
  amcatScore: user.amcatScore ?? user.mcatScore ?? "",
  skills: Array.isArray(user.skills) ? user.skills.join(", ") : user.skills ?? "",
  linkedin: user.linkedin ?? "",
  github: user.github ?? "",
  internships: user.internships ?? "",
  projects: user.projects ?? "",
  district: user.address?.district ?? "",
  state: user.address?.state ?? "",
  country: user.address?.country ?? "",
  pincode: user.address?.pincode ?? "",
});

const normalizeFileUrl = (url = "", resourceType = "") =>
  resourceType === "raw" && url.includes("/image/upload/")
    ? url.replace("/image/upload/", "/raw/upload/")
    : url;

const displayValue = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "N/A";
  }

  if (typeof value === "string") {
    return value.trim() || "N/A";
  }

  if (value === undefined || value === null || value === "") {
    return "N/A";
  }

  return String(value);
};

const formatPlacementStatus = (value) => {
  const map = {
    placed: "Placed",
    unplaced: "Unplaced",
    higherStudies: "Higher Studies",
    notInterested: "Not Interested",
  };

  return map[value] || displayValue(value);
};

const formatDateLabel = (value) => {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return displayValue(value);
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getInitials = (fullName) =>
  (fullName || "Student")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "S";

const Profile = () => {
  const { fetchUser } = useAuth();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [files, setFiles] = useState({});
  const [activeTab, setActiveTab] = useState("personal");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await API.get("/users/profile");
        const nextUser = response.data.user;
        setUser(nextUser);
        setForm(buildFormState(nextUser));
      } catch {
        setMessage({
          type: "error",
          text: "Unable to load profile details right now.",
        });
      }
    };

    loadProfile();
  }, []);

  const initials = useMemo(() => getInitials(user?.fullname), [user?.fullname]);

  const documentItems = useMemo(() => {
    const mapped = documentFields
      .map(({ key, label }) => {
        const file = user?.certificates?.[key];

        if (!file?.secure_url) {
          return null;
        }

        return {
          key,
          label,
          url: normalizeFileUrl(file.secure_url, file.resource_type),
          resourceType: file.resource_type,
        };
      })
      .filter(Boolean);

    const otherItems = Array.isArray(user?.certificates?.other)
      ? user.certificates.other
          .filter((item) => item?.secure_url)
          .map((item, index) => ({
            key: `other-${index}`,
            label: item.title || `Certificate ${index + 1}`,
            url: normalizeFileUrl(item.secure_url, item.resource_type),
            resourceType: item.resource_type,
          }))
      : [];

    return [...mapped, ...otherItems];
  }, [user]);

  const openEdit = () => {
    setForm(buildFormState(user));
    setFiles({});
    setActiveStep(0);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setForm(buildFormState(user));
    setFiles({});
    setActiveStep(0);
    setIsEditOpen(false);
  };

  const handleChange = ({ target }) => {
    setForm((previous) => ({
      ...previous,
      [target.name]: target.value,
    }));
  };

  const handleFileChange = (name, file) => {
    if (!file) {
      return;
    }

    setFiles((previous) => ({
      ...previous,
      [name]: file,
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    setMessage({ type: "", text: "" });

    try {
      const payload = {
        ...form,
        address: {
          district: form.district,
          state: form.state,
          country: form.country,
          pincode: form.pincode,
        },
      };

      delete payload.district;
      delete payload.state;
      delete payload.country;
      delete payload.pincode;

      const formData = new FormData();

      Object.entries(payload).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          formData.append(
            key,
            typeof value === "object" ? JSON.stringify(value) : value,
          );
        }
      });

      Object.entries(files).forEach(([key, value]) => {
        if (value) {
          formData.append(key, value);
        }
      });

      await API.put("/users/updateProfile", formData);

      const refreshedUser = await fetchUser();
      const nextUser = refreshedUser || user;

      setUser(nextUser);
      setForm(buildFormState(nextUser));
      setFiles({});
      setIsEditOpen(false);
      setActiveStep(0);
      setMessage({
        type: "success",
        text: "Profile updated successfully.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Profile update failed. Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="profile-loading-shell">
        <p className="profile-loading">Loading profile...</p>
      </div>
    );
  }

  const personalCards = [
    {
      title: "Contact Information",
      icon: Mail,
      rows: [
        { label: "Email", value: user.email },
        { label: "Phone", value: user.phone },
        { label: "Roll Number", value: user.rollNo },
      ],
    },
    {
      title: "Personal Details",
      icon: User,
      rows: [
        { label: "Full Name", value: user.fullname },
        { label: "Gender", value: user.gender },
        { label: "Date of Birth", value: formatDateLabel(user.dob) },
      ],
    },
    {
      title: "Address Information",
      icon: MapPin,
      rows: [
        { label: "District", value: user.address?.district },
        { label: "State", value: user.address?.state },
        { label: "Country", value: user.address?.country },
        { label: "Pincode", value: user.address?.pincode },
      ],
      wide: true,
    },
  ];

  const educationCards = [
    {
      title: "Academic Snapshot",
      icon: GraduationCap,
      rows: [
        { label: "Branch", value: user.branch },
        { label: "Batch", value: user.batch },
        { label: "Graduation Year", value: user.graduationYear },
        { label: "CGPA", value: user.cgpa },
        { label: "Backlogs", value: user.backlogs },
      ],
    },
    {
      title: "Score Overview",
      icon: FileText,
      rows: [
        { label: "10th Percentage", value: user.tenthPercent },
        { label: "12th Percentage", value: user.twelthPercent ?? user.twelfthPercent },
        { label: "Cocubes Score", value: user.cocubesScore },
        { label: "AMCAT Score", value: user.amcatScore ?? user.mcatScore },
      ],
    },
  ];

  const careerCards = [
    {
      title: "Placement Status",
      icon: Briefcase,
      rows: [
        { label: "Current Status", value: formatPlacementStatus(user.placementStatus) },
        { label: "Branch", value: user.branch },
        { label: "Graduation Year", value: user.graduationYear },
      ],
    },
    {
      title: "Skills",
      icon: Sparkles,
      skills: Array.isArray(user.skills)
        ? user.skills
        : String(user.skills || "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
    },
    {
      title: "Contact Links",
      icon: Link2,
      links: [
        { label: "LinkedIn", value: user.linkedin },
        { label: "GitHub", value: user.github },
      ],
    },
    {
      title: "Projects & Training",
      icon: FileText,
      textBlocks: [
        { label: "Projects", value: user.projects },
        { label: "Internships", value: user.internships },
      ],
      wide: true,
    },
  ];

  const renderContent = () => {
    if (activeTab === "personal") {
      return (
        <div className="profile-card-grid">
          {personalCards.map((card) => (
            <ProfileCard
              key={card.title}
              title={card.title}
              icon={card.icon}
              wide={card.wide}
            >
              <InfoRows rows={card.rows} />
            </ProfileCard>
          ))}
        </div>
      );
    }

    if (activeTab === "education") {
      return (
        <div className="profile-card-grid">
          {educationCards.map((card) => (
            <ProfileCard
              key={card.title}
              title={card.title}
              icon={card.icon}
            >
              <InfoRows rows={card.rows} />
            </ProfileCard>
          ))}

          <ProfileCard title="Uploaded Documents" icon={FileText} wide>
            <DocumentGrid items={documentItems} />
          </ProfileCard>
        </div>
      );
    }

    return (
      <div className="profile-card-grid">
        {careerCards.map((card) => (
          <ProfileCard
            key={card.title}
            title={card.title}
            icon={card.icon}
            wide={card.wide}
          >
            {card.rows ? <InfoRows rows={card.rows} /> : null}
            {card.skills ? <SkillCloud skills={card.skills} /> : null}
            {card.links ? <LinkRows rows={card.links} /> : null}
            {card.textBlocks ? <TextBlocks blocks={card.textBlocks} /> : null}
          </ProfileCard>
        ))}
      </div>
    );
  };

  return (
    <div className="page-shell profile-page">
      <div className="page-inner profile-layout">
        <section className="profile-summary-card">
          <div className="profile-summary-main">
            <div className="profile-avatar-shell">
              {user.avatar?.secure_url ? (
                <img
                  src={user.avatar.secure_url}
                  alt={`${user.fullname} avatar`}
                  className="profile-avatar"
                />
              ) : (
                <div className="profile-avatar-fallback">{initials}</div>
              )}
            </div>

            <div className="profile-summary-copy">
              <h1>{displayValue(user.fullname)}</h1>
              <div className="profile-summary-line">
                <Mail size={16} />
                <span>{displayValue(user.email)}</span>
              </div>
              <div className="profile-summary-pills">
                <span>{displayValue(user.branch)}</span>
                <span>{displayValue(user.batch)}</span>
                <span>{formatPlacementStatus(user.placementStatus)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={openEdit}
            className="profile-edit-trigger"
          >
            <PenSquare size={16} />
            Edit Profile
          </button>
        </section>

        {message.text ? (
          <div className={`profile-alert profile-alert-${message.type}`}>
            {message.text}
          </div>
        ) : null}

        <div className="profile-tabs">
          {viewTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={active ? "profile-tab active" : "profile-tab"}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {renderContent()}
      </div>

      {isEditOpen ? (
        <EditProfileModal
          user={user}
          form={form}
          files={files}
          activeStep={activeStep}
          setActiveStep={setActiveStep}
          onClose={closeEdit}
          onChange={handleChange}
          onFileChange={handleFileChange}
          onSave={saveProfile}
          saving={saving}
          documentItems={documentItems}
          initials={initials}
        />
      ) : null}
    </div>
  );
};

const ProfileCard = ({ title, icon, wide = false, children }) => {
  const Icon = icon;

  return (
    <article className={wide ? "profile-card profile-card-wide" : "profile-card"}>
      <div className="profile-card-head">
        <div className="profile-card-icon">
          <Icon size={18} />
        </div>
        <h2>{title}</h2>
      </div>
      {children}
    </article>
  );
};

const InfoRows = ({ rows }) => (
  <div className="profile-info-rows">
    {rows.map((row) => (
      <div key={row.label} className="profile-info-row">
        <span>{row.label}</span>
        <strong>{displayValue(row.value)}</strong>
      </div>
    ))}
  </div>
);

const LinkRows = ({ rows }) => (
  <div className="profile-link-stack">
    {rows.map((row) => (
      <div key={row.label} className="profile-link-row">
        <span>{row.label}</span>
        {row.value ? (
          <a href={row.value} target="_blank" rel="noreferrer">
            Open Link
          </a>
        ) : (
          <strong>N/A</strong>
        )}
      </div>
    ))}
  </div>
);

const TextBlocks = ({ blocks }) => (
  <div className="profile-text-blocks">
    {blocks.map((block) => (
      <div key={block.label} className="profile-text-block">
        <span>{block.label}</span>
        <p>{displayValue(block.value)}</p>
      </div>
    ))}
  </div>
);

const SkillCloud = ({ skills }) => (
  <div className="profile-skill-cloud">
    {skills.length ? (
      skills.map((skill) => (
        <span key={skill} className="profile-skill-pill">
          {skill}
        </span>
      ))
    ) : (
      <span className="profile-empty-state">No skills added yet.</span>
    )}
  </div>
);

const DocumentGrid = ({ items }) => (
  <div className="profile-document-grid">
    {items.length ? (
      items.map((item) => (
        <a
          key={item.key}
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="profile-document-tile"
        >
          <FileText size={18} />
          <div>
            <strong>{item.label}</strong>
            <span>View document</span>
          </div>
        </a>
      ))
    ) : (
      <div className="profile-empty-block">No documents uploaded yet.</div>
    )}
  </div>
);

const EditProfileModal = ({
  user,
  form,
  files,
  activeStep,
  setActiveStep,
  onClose,
  onChange,
  onFileChange,
  onSave,
  saving,
  documentItems,
  initials,
}) => {
  const isFirstStep = activeStep === 0;
  const isLastStep = activeStep === editSteps.length - 1;
  const panelBodyRef = useRef(null);

  const nextLabel = isLastStep ? (saving ? "Saving..." : "Save Changes") : "Save & Next";

  useEffect(() => {
    panelBodyRef.current?.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [activeStep]);

  const renderStepContent = () => {
    if (activeStep === 0) {
      return (
        <>
          <div className="profile-edit-banner">
            Keep your profile details updated so job invites and preparation tools stay aligned with your latest information.
          </div>

          <div className="profile-edit-basic-grid">
            <div className="profile-edit-avatar-card">
              {user.avatar?.secure_url ? (
                <img
                  src={user.avatar.secure_url}
                  alt={`${user.fullname} avatar`}
                  className="profile-edit-avatar"
                />
              ) : (
                <div className="profile-edit-avatar-fallback">{initials}</div>
              )}

              <FileUploadField
                label="Profile Photo"
                name="avatar"
                file={files.avatar}
                currentUrl={user.avatar?.secure_url}
                onFileChange={onFileChange}
                accept="image/*"
              />
            </div>

            <div className="profile-edit-fields">
              <div className="profile-edit-form-grid">
                <InputField
                  label="Full Name"
                  name="fullname"
                  value={form.fullname}
                  onChange={onChange}
                />
                <InputField
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={onChange}
                  disabled
                />
                <InputField
                  label="Phone"
                  name="phone"
                  value={form.phone}
                  onChange={onChange}
                />
                <InputField
                  label="Roll Number"
                  name="rollNo"
                  value={form.rollNo}
                  onChange={onChange}
                />
                <SelectField
                  label="Gender"
                  name="gender"
                  value={form.gender}
                  onChange={onChange}
                  options={["Male", "Female", "Other"]}
                />
                <InputField
                  label="Date of Birth"
                  type="date"
                  name="dob"
                  value={form.dob}
                  onChange={onChange}
                />
              </div>
            </div>
          </div>
        </>
      );
    }

    if (activeStep === 1) {
      return (
        <div className="profile-edit-form-grid">
          <InputField
            label="Branch"
            name="branch"
            value={form.branch}
            onChange={onChange}
          />
          <InputField
            label="Batch"
            name="batch"
            value={form.batch}
            onChange={onChange}
          />
          <InputField
            label="Graduation Year"
            name="graduationYear"
            value={form.graduationYear}
            onChange={onChange}
          />
          <InputField
            label="CGPA"
            name="cgpa"
            value={form.cgpa}
            onChange={onChange}
          />
          <InputField
            label="Backlogs"
            name="backlogs"
            value={form.backlogs}
            onChange={onChange}
          />
          <SelectField
            label="Placement Status"
            name="placementStatus"
            value={form.placementStatus}
            onChange={onChange}
            options={["placed", "unplaced", "higherStudies", "notInterested"]}
          />
          <InputField
            label="10th Percentage"
            name="tenthPercent"
            value={form.tenthPercent}
            onChange={onChange}
          />
          <InputField
            label="12th Percentage"
            name="twelthPercent"
            value={form.twelthPercent}
            onChange={onChange}
          />
          <InputField
            label="Cocubes Score"
            name="cocubesScore"
            value={form.cocubesScore}
            onChange={onChange}
          />
          <InputField
            label="AMCAT Score"
            name="amcatScore"
            value={form.amcatScore}
            onChange={onChange}
          />
        </div>
      );
    }

    if (activeStep === 2) {
      return (
        <div className="profile-edit-form-grid">
          <InputField
            label="District"
            name="district"
            value={form.district}
            onChange={onChange}
          />
          <InputField
            label="State"
            name="state"
            value={form.state}
            onChange={onChange}
          />
          <InputField
            label="Country"
            name="country"
            value={form.country}
            onChange={onChange}
          />
          <InputField
            label="Pincode"
            name="pincode"
            value={form.pincode}
            onChange={onChange}
          />
        </div>
      );
    }

    return (
      <>
        <div className="profile-edit-form-grid">
          <InputField
            label="Skills"
            name="skills"
            value={form.skills}
            onChange={onChange}
            placeholder="React, Java, DSA"
          />
          <InputField
            label="LinkedIn"
            name="linkedin"
            value={form.linkedin}
            onChange={onChange}
          />
          <InputField
            label="GitHub"
            name="github"
            value={form.github}
            onChange={onChange}
          />
          <TextAreaField
            label="Projects"
            name="projects"
            value={form.projects}
            onChange={onChange}
          />
          <TextAreaField
            label="Internships / Training"
            name="internships"
            value={form.internships}
            onChange={onChange}
          />
        </div>

        <div className="profile-edit-document-block">
          <div className="profile-edit-document-head">
            <h3>Documents</h3>
            <p>Replace the current files only where needed.</p>
          </div>

          <div className="profile-edit-upload-grid">
            {documentFields.map((item) => (
              <FileUploadField
                key={item.key}
                label={item.label}
                name={item.key}
                file={files[item.key]}
                currentUrl={
                  documentItems.find((doc) => doc.key === item.key)?.url || ""
                }
                onFileChange={onFileChange}
              />
            ))}
          </div>
        </div>
      </>
    );
  };

  return (
    <div
      className="profile-edit-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="profile-edit-modal">
        <aside className="profile-edit-sidebar">
          <div className="profile-edit-sidebar-head">
            <h2>Edit Profile</h2>
            <button type="button" className="profile-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <div className="profile-step-list">
            {editSteps.map((step, index) => {
              const active = index === activeStep;

              return (
                <button
                  key={step.id}
                  type="button"
                  className={active ? "profile-step-item active" : "profile-step-item"}
                  onClick={() => setActiveStep(index)}
                >
                  <span className="profile-step-count">{index + 1}</span>
                  <span className="profile-step-copy">
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="profile-edit-panel">
          <div className="profile-edit-panel-head">
            <div>
              <span className="profile-edit-step-label">
                Step {activeStep + 1} of {editSteps.length}
              </span>
              <h3>{editSteps[activeStep].title}</h3>
            </div>
          </div>

          <div ref={panelBodyRef} className="profile-edit-panel-body">
            {renderStepContent()}
          </div>

          <div className="profile-edit-footer">
            <button
              type="button"
              className="profile-footer-btn profile-footer-btn-muted"
              onClick={() => {
                if (isFirstStep) {
                  onClose();
                  return;
                }

                setActiveStep((previous) => previous - 1);
              }}
            >
              <ChevronLeft size={16} />
              {isFirstStep ? "Close" : "Back"}
            </button>

            <button
              type="button"
              className="profile-footer-btn profile-footer-btn-primary"
              disabled={saving}
              onClick={() => {
                if (isLastStep) {
                  onSave();
                  return;
                }

                setActiveStep((previous) => previous + 1);
              }}
            >
              {nextLabel}
              {!isLastStep ? <ChevronRight size={16} /> : null}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  disabled = false,
  placeholder = "",
}) => (
  <label className="profile-form-field">
    <span>{label}</span>
    <input
      type={type}
      name={name}
      value={value || ""}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  </label>
);

const TextAreaField = ({ label, name, value, onChange }) => (
  <label className="profile-form-field profile-form-field-wide">
    <span>{label}</span>
    <textarea name={name} value={value || ""} onChange={onChange} rows={4} />
  </label>
);

const SelectField = ({ label, name, value, onChange, options }) => (
  <label className="profile-form-field">
    <span>{label}</span>
    <select name={name} value={value || ""} onChange={onChange}>
      <option value="">Select</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {formatPlacementStatus(option)}
        </option>
      ))}
    </select>
  </label>
);

const FileUploadField = ({
  label,
  name,
  file,
  currentUrl,
  onFileChange,
  accept = "image/*,.pdf,.doc,.docx",
}) => (
  <label className="profile-upload-field">
    <input
      type="file"
      hidden
      accept={accept}
      onChange={(event) => onFileChange(name, event.target.files?.[0])}
    />
    <span className="profile-upload-icon">
      <Upload size={16} />
    </span>
    <strong>{label}</strong>
    <small>{file?.name || (currentUrl ? "Replace current file" : "Choose file")}</small>
    {currentUrl ? (
      <a
        href={currentUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
      >
        View current
      </a>
    ) : null}
  </label>
);

export default Profile;
