"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from "lucide-react";
import { EMPTY_PROFILE, saveProfile, STATES } from "@/lib/ui/profile";
import type { StudentProfile } from "@/lib/ui/types";

const STEPS = [
  { title: "Where are you from?", hint: "Use the state where you hold domicile." },
  { title: "Your family and category", hint: "Use the details on your certificates." },
  { title: "What are you studying?", hint: "Tell us about your current course." },
  { title: "A few more details", hint: "Some schemes support specific student groups." },
  { title: "Your family’s work and education", hint: "This helps check more published rules." },
];

type Errors = Partial<Record<keyof StudentProfile, string>>;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={`${id}-error`} className="mt-2 text-sm text-status-red">
      {message}
    </p>
  ) : null;
}

// An optional number: blank is fine, anything else must be in range.
function checkOptionalNumber(value: string, min: number, max: number): boolean {
  const t = value.trim();
  if (t === "") return true;
  const n = Number(t);
  return Number.isFinite(n) && n >= min && n <= max;
}

export function ProfileStepper({
  initial = EMPTY_PROFILE,
  onComplete,
}: {
  // The answers saved earlier in this browser (or an empty profile).
  initial?: StudentProfile;
  onComplete: (profile: StudentProfile) => void | Promise<void>;
}) {
  const [profile, setProfile] = useState<StudentProfile>(initial);
  const latest = useRef<StudentProfile>(initial);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [storageWarning, setStorageWarning] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  // Every answer is saved in this browser only (localStorage) the moment it
  // changes. Nothing is sent anywhere.
  function update<K extends keyof StudentProfile>(
    key: K,
    value: StudentProfile[K],
  ) {
    latest.current = { ...latest.current, [key]: value };
    setProfile(latest.current);
    setStorageWarning(
      saveProfile(latest.current)
        ? ""
        : "This browser cannot save your answers. You can still complete the form in this tab.",
    );
    setErrors((previous) => ({ ...previous, [key]: undefined }));
    setSubmitError("");
  }

  function validate(): Errors {
    const next: Errors = {};
    const requireField = (key: keyof StudentProfile, message: string) => {
      if (!profile[key]) next[key] = message;
    };

    if (step === 0) {
      requireField("state", "Choose your state or union territory.");
    }

    if (step === 1) {
      requireField("category", "Choose your category.");
      const income = Number(profile.annualIncome);
      if (
        profile.annualIncome.trim() === "" ||
        !Number.isFinite(income) ||
        income < 0 ||
        !Number.isInteger(income)
      ) {
        next.annualIncome = "Enter your annual family income in whole rupees.";
      }
    }

    if (step === 2) {
      requireField("level", "Choose UG or PG.");
      requireField("year", "Choose your current year.");
      requireField("courseType", "Choose a course type.");
      if (!checkOptionalNumber(profile.marksPercent, 0, 100)) {
        next.marksPercent = "Enter a percentage from 0 to 100, or leave it blank.";
      }
    }

    if (step === 3) {
      requireField("gender", "Choose an answer.");
      requireField("disability", "Choose yes or no.");
      requireField("minorityCommunity", "Choose an answer.");
      if (!checkOptionalNumber(profile.age, 0, 120)) {
        next.age = "Enter your age in years, or leave it blank.";
      }
      if (!checkOptionalNumber(profile.workYears, 0, 80)) {
        next.workYears = "Enter years from 0 to 80 (for example 1.5), or leave it blank.";
      }
    }

    if (step === 4) {
      requireField("parentOccupation", "Choose the closest occupation.");
      requireField("firstGeneration", "Choose yes or no.");
    }

    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      document.getElementById(firstError)?.focus();
      return;
    }

    if (step < STEPS.length - 1) {
      setStep((value) => value + 1);
      return;
    }

    setBusy(true);
    setSubmitError("");

    try {
      await onComplete(profile);
    } catch {
      setSubmitError("We could not continue. Your answers are still on this screen.");
    } finally {
      setBusy(false);
    }
  }

  function select(
    key: keyof StudentProfile,
    label: string,
    options: string[],
    hint?: string,
  ) {
    return (
      <div>
        <label htmlFor={key} className="field-label">{label}</label>
        {hint && (
          <p id={`${key}-hint`} className="mb-2 text-sm text-muted">{hint}</p>
        )}
        <select
          id={key}
          name={key}
          value={profile[key]}
          onChange={(event) =>
            update(key, event.target.value as StudentProfile[typeof key])
          }
          className="field"
          required
          aria-invalid={Boolean(errors[key])}
          aria-describedby={[
            hint ? `${key}-hint` : "",
            errors[key] ? `${key}-error` : "",
          ].filter(Boolean).join(" ") || undefined}
        >
          <option value="">Choose an option</option>
          {options.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
        <FieldError id={key} message={errors[key]} />
      </div>
    );
  }

  function optionalNumber(
    key: "marksPercent" | "age" | "workYears",
    label: string,
    hint: string,
    step = "any",
  ) {
    return (
      <div>
        <label htmlFor={key} className="field-label">
          {label} <span className="font-normal text-muted">(optional)</span>
        </label>
        <p id={`${key}-hint`} className="mb-2 text-sm text-muted">{hint}</p>
        <input
          id={key}
          name={key}
          type="number"
          inputMode="decimal"
          min="0"
          step={step}
          value={profile[key]}
          onChange={(event) => update(key, event.target.value)}
          className="field"
          aria-invalid={Boolean(errors[key])}
          aria-describedby={`${key}-hint${errors[key] ? ` ${key}-error` : ""}`}
        />
        <FieldError id={key} message={errors[key]} />
      </div>
    );
  }

  function yesNo(key: "disability" | "firstGeneration", label: string, hint?: string) {
    return (
      <fieldset
        id={key}
        tabIndex={-1}
        aria-describedby={errors[key] ? `${key}-error` : undefined}
      >
        <legend className="field-label">{label}</legend>
        {hint && <p className="mb-3 text-sm text-muted">{hint}</p>}
        <div className="grid grid-cols-2 gap-3">
          {(["yes", "no"] as const).map((answer) => (
            <label
              key={answer}
              className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border p-4 ${
                profile[key] === answer
                  ? "border-brand bg-brand-light"
                  : "border-muted bg-white"
              }`}
            >
              <input
                type="radio"
                name={key}
                value={answer}
                checked={profile[key] === answer}
                onChange={() => update(key, answer)}
                className="size-5 accent-brand"
                required
              />
              {answer === "yes" ? "Yes" : "No"}
            </label>
          ))}
        </div>
        <FieldError id={key} message={errors[key]} />
      </fieldset>
    );
  }

  return (
    <main id="main-content" className="page">
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside>
          <p className="eyebrow">Your profile</p>
          <h1 className="mt-3 font-display text-3xl font-semibold">
            One step at a time.
          </h1>
          <p className="mt-3 text-muted">No login. You can change your answers later.</p>

          <ol aria-label="Profile steps" className="mt-8 hidden space-y-5 lg:block">
            {STEPS.map((item, index) => (
              <li
                key={item.title}
                aria-current={index === step ? "step" : undefined}
                className={`flex items-center gap-3 ${
                  index === step ? "font-semibold text-brand" : "text-muted"
                }`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                  index < step
                    ? "bg-brand text-white"
                    : index === step
                      ? "bg-accent text-ink"
                      : "border border-line bg-white"
                }`}>
                  {index < step
                    ? <Check size={17} aria-hidden="true" />
                    : index + 1}
                </span>
                {item.title}
              </li>
            ))}
          </ol>
        </aside>

        <section className="card p-5 sm:p-8">
          <p id="step-progress-label" className="text-sm font-semibold text-brand">
            Step {step + 1} of {STEPS.length}
          </p>
          <progress
            aria-labelledby="step-progress-label"
            value={step + 1}
            max={STEPS.length}
            className="mt-3 h-2 w-full overflow-hidden rounded-full accent-brand"
          />

          <div className="mt-7">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="font-display text-2xl font-semibold sm:text-3xl"
            >
              {STEPS[step].title}
            </h2>
            <p className="mt-2 text-muted">{STEPS[step].hint}</p>
          </div>

          {(
            <form onSubmit={submit} noValidate aria-busy={busy}>
              <fieldset disabled={busy} className="mt-7">
                <legend className="sr-only">{STEPS[step].title}</legend>
                <div key={step} className="animate-enter space-y-6">
                  {step === 0 && select("state", "State or union territory", STATES)}

                  {step === 1 && (
                    <>
                      {select("category", "Category", ["General", "OBC", "SC", "ST", "EWS"])}
                      <div>
                        <label htmlFor="annualIncome" className="field-label">
                          Family income per year
                        </label>
                        <p id="income-hint" className="mb-2 text-sm text-muted">
                          Enter the total in rupees, for example 240000.
                        </p>
                        <div className="relative">
                          <span aria-hidden="true" className="absolute left-4 top-3">₹</span>
                          <input
                            id="annualIncome"
                            name="annualIncome"
                            type="number"
                            inputMode="numeric"
                            min="0"
                            step="1"
                            value={profile.annualIncome}
                            onChange={(event) => update("annualIncome", event.target.value)}
                            className="field pl-9"
                            required
                            aria-invalid={Boolean(errors.annualIncome)}
                            aria-describedby={`income-hint${errors.annualIncome ? " annualIncome-error" : ""}`}
                          />
                        </div>
                        <FieldError id="annualIncome" message={errors.annualIncome} />
                      </div>
                    </>
                  )}

                  {step === 2 && (
                    <>
                      <div>
                        <label htmlFor="level" className="field-label">Study level</label>
                        <select
                          id="level"
                          value={profile.level}
                          onChange={(event) => {
                            update("level", event.target.value as StudentProfile["level"]);
                            update("year", "");
                          }}
                          className="field"
                          required
                          aria-invalid={Boolean(errors.level)}
                          aria-describedby={errors.level ? "level-error" : undefined}
                        >
                          <option value="">Choose a level</option>
                          <option value="UG">UG — undergraduate</option>
                          <option value="PG">PG — postgraduate</option>
                        </select>
                        <FieldError id="level" message={errors.level} />
                      </div>
                      {select(
                        "year",
                        "Current year",
                        profile.level === "PG"
                          ? ["1", "2", "3", "4 or later"]
                          : ["1", "2", "3", "4", "5", "6 or later"],
                      )}
                      {select("courseType", "Course type", [
                        "Arts and humanities",
                        "Science",
                        "Commerce",
                        "Engineering and technology",
                        "Medicine and health",
                        "Law",
                        "Management",
                        "Agriculture",
                        "Education",
                        "Other",
                      ])}
                      {optionalNumber(
                        "marksPercent",
                        "Marks in your last exam (%)",
                        "Percentage, not CGPA. Many schemes have a minimum.",
                      )}
                    </>
                  )}

                  {step === 3 && (
                    <>
                      {select("gender", "Gender", [
                        "Woman", "Man", "Transgender", "Another identity", "Prefer not to say",
                      ])}
                      {yesNo("disability", "Do you have a disability?")}
                      {select("minorityCommunity", "Minority community", [
                        "None", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Parsi",
                        "Another community", "Prefer not to say",
                      ], "This answer alone does not confirm eligibility. Each scheme has its own rules.")}
                      {optionalNumber(
                        "age",
                        "Your age in years",
                        "Some schemes have an age limit.",
                        "1",
                      )}
                      {optionalNumber(
                        "workYears",
                        "Years of full-time work",
                        "After your degree. Use 0 if none. Needed for notices that ask for work experience.",
                      )}
                    </>
                  )}

                  {step === 4 && (
                    <>
                      {select("parentOccupation", "Parent or guardian’s main occupation", [
                        "Farming",
                        "Daily-wage or construction work",
                        "Artisan or craft work",
                        "Self-employed or small business",
                        "Salaried — private sector",
                        "Salaried — government",
                        "Defence or ex-service",
                        "Not currently working",
                        "Other",
                        "Prefer not to say",
                      ])}
                      {yesNo(
                        "firstGeneration",
                        "Are you the first generation in your family to attend college?",
                        "For this profile, choose Yes if neither parent has attended college. A scheme may use a different definition.",
                      )}
                    </>
                  )}
                </div>

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
                  <button
                    type="button"
                    onClick={() => {
                      setErrors({});
                      setSubmitError("");
                      setStep((value) => value - 1);
                    }}
                    disabled={step === 0}
                    className="btn-secondary"
                  >
                    <ArrowLeft size={18} aria-hidden="true" />
                    Back
                  </button>
                  <button type="submit" className="btn-primary">
                    {busy
                      ? "Please wait…"
                      : step === STEPS.length - 1
                        ? "See my scholarships"
                        : "Continue"}
                    {!busy && <ArrowRight size={18} aria-hidden="true" />}
                  </button>
                </div>
              </fieldset>

              {submitError && <p role="alert" className="mt-4 text-status-red">{submitError}</p>}
            </form>
          )}

          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <LockKeyhole size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            Your answers stay in your browser.
          </p>
          {storageWarning && (
            <p role="status" className="mt-2 text-sm text-status-amber">{storageWarning}</p>
          )}
        </section>
      </div>
    </main>
  );
}
