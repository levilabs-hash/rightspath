export type OfficialSource = {
  id: string;
  publisher: string;
  program: string;
  title: string;
  topic: string;
  explanation: string;
  href: string;
};

export const officialSources = [
  {
    id: "courts-deposits",
    publisher: "California Courts",
    program: "Self-Help",
    title: "Guide to security deposits in California",
    topic: "Security deposits",
    explanation:
      "Official court guidance for renters with questions about a security deposit.",
    href: "https://selfhelp.courts.ca.gov/guide-security-deposits-california",
  },
  {
    id: "courts-eviction",
    publisher: "California Courts",
    program: "Self-Help",
    title: "The eviction process for tenants",
    topic: "Eviction notices",
    explanation:
      "Official court guidance on the process that begins when a landlord gives a written notice.",
    href: "https://selfhelp.courts.ca.gov/eviction-tenant",
  },
  {
    id: "ag-landlord-tenant",
    publisher: "California Department of Justice",
    program: "Office of the Attorney General",
    title: "Landlord-Tenant Issues",
    topic: "Housing conditions",
    explanation:
      "Official guidance on landlord-tenant issues, including housing conditions and where to find legal help.",
    href: "https://oag.ca.gov/consumers/general/landlord-tenant-issues",
  },
] as const satisfies readonly OfficialSource[];

export const lawHelpCa = {
  name: "LawHelpCA",
  href: "https://www.lawhelpca.org/",
  description: "A directory of legal aid offices in California.",
} as const;
