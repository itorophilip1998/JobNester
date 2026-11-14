import { emptyState, matchAll, type Job, type AppState } from "@jobnester/core";
export function demoState(): AppState {
  const s = emptyState();
  s.profile = {
    name: "Itoro Philip",
    headline: "Senior Full-Stack & Backend Engineer",
    country: "",
    timezone: "Africa/Lagos",
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "PostgreSQL",
      "APIs",
      "Docker",
      "Kubernetes",
      "Azure",
      "Python",
      "LLM",
      "FastAPI",
      "System design",
      "Distributed systems",
      "Terraform",
      "CI/CD",
      "AWS",
    ],
    evidence: [
      {
        id: "demo-1",
        company: "Example Technology Co.",
        role: "Senior Software Engineer",
        start: "2021",
        end: "Present",
        text: "Built full-stack applications with TypeScript, React, Node.js, and PostgreSQL.",
      },
      {
        id: "demo-2",
        company: "Example Technology Co.",
        role: "Senior Software Engineer",
        start: "2021",
        end: "Present",
        text: "Designed APIs and deployed services with Docker, Kubernetes, and Azure.",
      },
      {
        id: "demo-3",
        company: "Example Studio",
        role: "Software Engineer",
        start: "2017",
        end: "2021",
        text: "Integrated Python, FastAPI, and LLM services into application workflows.",
      },
    ],
    confirmed: true,
    salaryMin: 72000,
    employment: "Full-time or contract",
  };
  const rows = [
    [
      "Vercel",
      "Senior Full-Stack Engineer",
      "Worldwide",
      "Worldwide",
      "$140k – $190k",
      "TypeScript,React,Next.js,Node.js,PostgreSQL,APIs",
      "fullstack",
    ],
    [
      "Linear",
      "Senior Software Engineer",
      "US / Europe",
      "United States,United Kingdom,Germany",
      "$150k – $210k",
      "TypeScript,React,PostgreSQL,System design,Distributed systems,APIs",
      "software",
    ],
    [
      "Railway",
      "Senior Platform Engineer",
      "Worldwide",
      "Worldwide",
      "$130k – $180k",
      "Kubernetes,Docker,Terraform,AWS,CI/CD,Azure",
      "devops",
    ],
    [
      "Anthropic",
      "AI Application Engineer",
      "United States",
      "United States",
      "$160k – $230k",
      "Python,LLM,FastAPI,AI,Machine learning,PyTorch",
      "ai",
    ],
    [
      "Supabase",
      "Senior Backend Engineer",
      "Worldwide",
      "Worldwide",
      "$120k – $175k",
      "TypeScript,Node.js,PostgreSQL,APIs,System design,Distributed systems",
      "fullstack",
    ],
    [
      "Grafana Labs",
      "Senior DevOps Engineer",
      "EMEA",
      "United Kingdom,Germany,Spain",
      "$115k – $165k",
      "Kubernetes,Docker,Terraform,AWS,CI/CD",
      "devops",
    ],
    [
      "Automattic",
      "Senior Software Engineer",
      "Worldwide",
      "Worldwide",
      "$110k – $180k",
      "React,TypeScript,Node.js,APIs,PostgreSQL,System design",
      "software",
    ],
    [
      "Hugging Face",
      "Machine Learning Engineer",
      "Worldwide",
      "Worldwide",
      "$125k – $190k",
      "Python,Machine learning,PyTorch,LLM,AI,FastAPI",
      "ai",
    ],
    [
      "GitLab",
      "Senior Full-Stack Developer",
      "Worldwide",
      "Worldwide",
      "$120k – $170k",
      "React,TypeScript,Node.js,PostgreSQL,APIs,Docker",
      "fullstack",
    ],
  ];
  s.jobs = rows.map((r, i) => {
    const date = new Date(Date.now() - (i + 1) * 3600000).toISOString();
    return matchAll(
      {
        id: `demo-job-${i}`,
        company: r[0],
        title: r[1],
        location: r[2],
        remote: true,
        countries: r[3] === "Worldwide" ? [] : r[3].split(","),
        worldwide: r[3] === "Worldwide",
        salary: r[4],
        salaryMin: null,
        employment: "Full-time",
        technologies: r[5].split(","),
        description: `Illustrative role for exploring JobNester. This is not a verified live vacancy.\n\nJoin an engineering team building thoughtful developer products. Own technical decisions, collaborate across disciplines, and deliver reliable software.\n\nRequirements\n${r[5]
          .split(",")
          .map((x) => `• Experience with ${x}`)
          .join(
            "\n",
          )}\n• Strong communication and architectural judgment\n• Ability to work in a distributed team\n\nLocation: ${r[2]}. Verify all eligibility and compensation details on the employer's actual careers page.`,
        url: `https://${({ Vercel: "vercel.com/careers", Linear: "linear.app/careers", Railway: "railway.com/careers", Anthropic: "anthropic.com/careers", Supabase: "supabase.com/careers", "Grafana Labs": "grafana.com/about/careers", Automattic: "automattic.com/work-with-us", "Hugging Face": "huggingface.co/join-us", GitLab: "about.gitlab.com/jobs" } as Record<string, string>)[r[0]]}`,
        source: "Demo",
        sourceId: `demo-${i}`,
        postedAt: date,
        discoveredAt: date,
        active: true,
        viewed: false,
        hidden: false,
        matches: {},
      } as Job,
      s.profile,
    );
  });
  s.applications = [0, 1, 2, 4].map((j, i) => ({
    id: `demo-app-${i}`,
    jobId: `demo-job-${j}`,
    stage: (["Saved", "Interviewing", "Applied", "Assessment"] as const)[i],
    resumeId: null,
    appliedAt: i ? new Date(Date.now() - i * 86400000).toISOString() : null,
    events: [
      {
        id: `event-${i}`,
        type: "status",
        at: new Date(Date.now() - i * 86400000).toISOString(),
        note: `Demo application ${i + 1}`,
      },
    ],
    followUp: null,
  }));
  s.portfolio = {
    name: s.profile.name,
    headline: s.profile.headline,
    bio: "I build thoughtful products and the systems that power them. My work brings together full-stack engineering, cloud architecture, and practical AI.",
    email: "",
    github: "https://github.com",
    location: "Available for international remote opportunities",
    skills: s.profile.skills,
    projects: [
      {
        id: "p1",
        title: "Cloud infrastructure",
        description:
          "A place for your architecture decisions, deployment approach, and verified results.",
        tags: ["Kubernetes", "Azure", "Terraform"],
        url: "",
        image: "",
      },
      {
        id: "p2",
        title: "AI-powered applications",
        description:
          "Show how you turn AI capabilities into practical product experiences.",
        tags: ["Python", "LLMs", "FastAPI"],
        url: "",
        image: "",
      },
      {
        id: "p3",
        title: "Full-stack engineering",
        description:
          "Document a real product from the first API to the final user experience.",
        tags: ["Next.js", "TypeScript", "PostgreSQL"],
        url: "",
        image: "",
      },
    ],
    experience: s.profile.evidence,
    published: false,
    publicResumeId: null,
  };
  return s;
}
