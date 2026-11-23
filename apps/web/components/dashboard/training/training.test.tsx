// @vitest-environment jsdom
import type { Database } from "@repo/db";
import { PERMISSIONS, type AdminCourse, type Permission } from "@repo/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ar from "@/messages/ar/DashboardTraining.json";
import arWorkspace from "@/messages/ar/Workspace.json";
import en from "@/messages/en/DashboardTraining.json";
import enWorkspace from "@/messages/en/Workspace.json";
import { CourseForm } from "./course-form";
import { CourseList } from "./course-list";
import { CoursePreview } from "./course-preview";
import {
  loadCustomRequests,
  loadNewRegistrationCount,
  loadRegistrations,
  NEW_REGISTRATION_DAYS,
  parseRegistrationParams,
  parseRequestParams,
  trainingAccess,
  type CustomRequestRow,
  type RegistrationRow,
} from "./data";
import { DeleteCourse } from "./delete-course";
import {
  courseProblems,
  courseTitle,
  courseValues,
  createBody,
  literalPattern,
  previewCourse,
  quotedValue,
  registrationsPath,
  requestsPath,
  toUtc,
  updateBody,
  type CourseValues,
} from "./format";
import { PublishToggle } from "./publish-toggle";
import { RegistrationList } from "./registration-list";
import { RequestList } from "./request-list";
import { deleteCourse } from "./send";

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(), clerkClient: vi.fn() }));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
const router = { refresh: vi.fn(), push: vi.fn() };
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => router,
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// The preview draws into an iframe; here it draws in place, so the test can read it.
vi.mock("@/components/dashboard/preview/preview-frame", () => ({
  PREVIEW_WIDTHS: { mobile: 375, desktop: 1280 },
  PreviewFrame: ({ children }: { children: ReactNode }) => <div data-testid="preview-frame">{children}</div>,
}));

// jsdom has no matchMedia. Narrow screen: LanguageTabs shows tabs.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

const fetchMock = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => json({ ok: true }));
  router.refresh.mockReset();
  router.push.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ID = "11111111-1111-4111-8111-111111111111";
const COURSE: AdminCourse = {
  id: ID,
  slug: "project-management",
  type: "in_person",
  titleAr: "إدارة المشاريع",
  titleEn: "Project management",
  descriptionAr: "وصف",
  descriptionEn: "A description",
  audienceAr: null,
  audienceEn: null,
  startsAt: "2026-12-01T09:00:00.000Z",
  placeAr: "عمّان",
  placeEn: "Amman",
  onlineUrl: null,
  seats: 20,
  status: "draft",
  registrationCount: 3,
};

function withIntl(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={
        locale === "ar" ? { DashboardTraining: ar, Workspace: arWorkspace } : { DashboardTraining: en, Workspace: enWorkspace }
      } timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

function sent() {
  return fetchMock.mock.calls.map(([url, init]) => ({
    url: String(url),
    method: init?.method,
    body: typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : init?.body,
  }));
}

type Call = [string, ...unknown[]];
type FakeResult = { data: unknown; error: { code: string } | null; count?: number | null };

/** A supabase-js stand-in: each chain records its calls and resolves to `answer`. */
function fakeClient(answer: (table: string, calls: Call[]) => FakeResult) {
  const queries: { table: string; calls: Call[] }[] = [];
  const client = {
    from(table: string) {
      const calls: Call[] = [];
      queries.push({ table, calls });
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "gte", "or", "filter", "order", "range"]) {
        chain[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return chain;
        };
      }
      chain.then = (resolve: (value: FakeResult) => unknown) => Promise.resolve(answer(table, calls)).then(resolve);
      return chain;
    },
  };
  return { client: client as unknown as SupabaseClient<Database>, queries };
}

describe("trainingAccess", () => {
  const params = Promise.resolve({ locale: "en" });
  const grant = (keys: Permission[]) => vi.fn(async () => new Set<Permission>(keys));

  it("opens with training.manage, and shows delete with data.delete", async () => {
    const check = grant([PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.DATA_DELETE]);
    expect(await trainingAccess(params, check)).toEqual({ locale: "en", allowed: true, canDelete: true });
    expect(check).toHaveBeenCalledWith([PERMISSIONS.TRAINING_MANAGE, PERMISSIONS.DATA_DELETE], "en");
  });

  it("refuses without training.manage, whatever else the member holds", async () => {
    const others = Object.values(PERMISSIONS).filter((key) => key !== PERMISSIONS.TRAINING_MANAGE);
    const access = await trainingAccess(params, grant(others));
    expect(access.allowed).toBe(false);
  });

  it("hides delete without data.delete", async () => {
    const access = await trainingAccess(Promise.resolve({ locale: "ar" }), grant([PERMISSIONS.TRAINING_MANAGE]));
    expect(access).toEqual({ locale: "ar", allowed: true, canDelete: false });
  });
});

describe("list params", () => {
  it("keeps the valid keys and drops the rest", () => {
    expect(parseRegistrationParams({ page: "2", course: ID, search: " sara ", other: "x" })).toEqual({
      page: 2,
      pageSize: 20,
      course: ID,
      search: "sara",
    });
  });

  it("falls back to the defaults for refused values", () => {
    expect(parseRegistrationParams({ page: "0", course: "not-a-uuid", pageSize: "999" })).toEqual({
      page: 1,
      pageSize: 20,
    });
    expect(parseRequestParams({ search: ["a", "b"], page: "x" })).toEqual({ page: 1, pageSize: 20, search: "a" });
  });

  it("builds list links without the defaults", () => {
    expect(registrationsPath({})).toBe("/dashboard/training/registrations");
    expect(registrationsPath({ course: ID, page: 2, pageSize: 20, search: "a b" })).toBe(
      `/dashboard/training/registrations?course=${ID}&search=a+b&page=2`,
    );
    expect(requestsPath({ page: 1, pageSize: 50 })).toBe("/dashboard/training/requests?pageSize=50");
  });
});

describe("search values", () => {
  it("matches the term letter for letter", () => {
    expect(literalPattern("a.b*(c)")).toBe("a\\.b\\*\\(c\\)");
    expect(new RegExp(literalPattern("a.b*(c)")).test("a.b*(c)")).toBe(true);
  });

  it("quotes a value so a comma or parenthesis can't add a filter", () => {
    expect(quotedValue('x,y)"z\\')).toBe('"x,y)\\"z\\\\"');
  });
});

describe("loadRegistrations", () => {
  const row = {
    id: "r1",
    created_at: "2026-11-10T08:00:00+00:00",
    client_id: "user_1",
    course_id: ID,
    client: { full_name: "Sara", email: "sara@example.com" },
    course: { title_ar: "عنوان", title_en: "Title" },
  };

  it("reads one page with the member's client, newest first, and maps the rows", async () => {
    const fake = fakeClient(() => ({ data: [row, { ...row, id: "r2", client: null, course: null }], error: null, count: 2 }));
    const result = await loadRegistrations({ page: 2, pageSize: 10, search: undefined }, fake.client);
    expect(result).toEqual({
      total: 2,
      registrations: [
        {
          id: "r1",
          createdAt: "2026-11-10T08:00:00.000Z",
          clientId: "user_1",
          name: "Sara",
          email: "sara@example.com",
          courseId: ID,
          courseTitleAr: "عنوان",
          courseTitleEn: "Title",
        },
        {
          id: "r2",
          createdAt: "2026-11-10T08:00:00.000Z",
          clientId: "user_1",
          name: null,
          email: null,
          courseId: ID,
          courseTitleAr: null,
          courseTitleEn: null,
        },
      ],
    });
    const [query] = fake.queries;
    expect(query.table).toBe("course_registrations");
    expect(String(query.calls[0][1])).not.toContain("!inner");
    expect(query.calls).toContainEqual(["order", "created_at", { ascending: false }]);
    expect(query.calls).toContainEqual(["range", 10, 19]);
  });

  it("keeps one course, and searches the name and email through an inner join", async () => {
    const fake = fakeClient(() => ({ data: [], error: null, count: 0 }));
    await loadRegistrations({ page: 1, pageSize: 20, course: ID, search: "a,b" }, fake.client);
    const calls = fake.queries[0].calls;
    expect(String(calls[0][1])).toContain("client:profiles!course_registrations_client_id_fkey!inner");
    expect(calls).toContainEqual(["eq", "course_id", ID]);
    expect(calls).toContainEqual([
      "or",
      'full_name.imatch."a,b",email.imatch."a,b"',
      { referencedTable: "client" },
    ]);
  });

  it("answers a page past the end with the count alone, filtered the same way", async () => {
    const fake = fakeClient((_table, calls) => {
      const head = (calls[0][2] as { head?: boolean }).head === true;
      return head ? { data: null, error: null, count: 3 } : { data: null, error: { code: "PGRST103" } };
    });
    const result = await loadRegistrations({ page: 9, pageSize: 20, course: ID, search: "sara" }, fake.client);
    expect(result).toEqual({ registrations: [], total: 3 });
    const [, counted] = fake.queries;
    expect(counted.calls[0][2]).toEqual({ count: "exact", head: true });
    expect(String(counted.calls[0][1])).toContain("!inner");
    expect(counted.calls).toContainEqual(["eq", "course_id", ID]);
    expect(counted.calls).toContainEqual(["or", 'full_name.imatch."sara",email.imatch."sara"', { referencedTable: "client" }]);
    expect(counted.calls.some(([method]) => method === "range")).toBe(false);
  });

  it("throws the code only on a read error", async () => {
    const fake = fakeClient(() => ({ data: null, error: { code: "42501" } }));
    await expect(loadRegistrations({ page: 1, pageSize: 20, search: undefined }, fake.client)).rejects.toThrow(
      "course_registrations read failed: 42501",
    );
  });
});

describe("loadCustomRequests", () => {
  it("reads newest first, links only a client RLS shows, and searches the organization", async () => {
    const base = {
      id: "q1",
      created_at: "2026-11-11T10:00:00Z",
      org_name: "Org",
      trainee_count: 12,
      topic: "Governance",
      suggested_date: "2027-01-15",
      place: null,
      contact_email: "org@example.com",
    };
    const fake = fakeClient(() => ({
      data: [
        { ...base, client: { clerk_user_id: "user_9" } },
        { ...base, id: "q2", client: null },
      ],
      error: null,
      count: 2,
    }));
    const result = await loadCustomRequests({ page: 1, pageSize: 20, search: "o.g" }, fake.client);
    expect(result.total).toBe(2);
    expect(result.requests.map((row) => row.clientId)).toEqual(["user_9", null]);
    expect(result.requests[0]).toMatchObject({ orgName: "Org", traineeCount: 12, suggestedDate: "2027-01-15" });
    const calls = fake.queries[0].calls;
    expect(fake.queries[0].table).toBe("custom_training_requests");
    expect(calls).toContainEqual(["filter", "org_name", "imatch", "o\\.g"]);
    expect(calls).toContainEqual(["order", "created_at", { ascending: false }]);
  });
});

describe("loadCustomRequests past the end", () => {
  it("answers with the count alone, searched the same way", async () => {
    const fake = fakeClient((_table, calls) =>
      (calls[0][2] as { head?: boolean }).head === true
        ? { data: null, error: null, count: 4 }
        : { data: null, error: { code: "PGRST103" } },
    );
    expect(await loadCustomRequests({ page: 5, pageSize: 20, search: "org" }, fake.client)).toEqual({
      requests: [],
      total: 4,
    });
    expect(fake.queries[1].calls).toContainEqual(["filter", "org_name", "imatch", "org"]);
  });

  it("still throws on another error", async () => {
    const fake = fakeClient(() => ({ data: null, error: { code: "42501" } }));
    await expect(loadCustomRequests({ page: 1, pageSize: 20, search: undefined }, fake.client)).rejects.toThrow(
      "custom_training_requests read failed: 42501",
    );
  });
});

describe("loadNewRegistrationCount", () => {
  it("counts the registrations of the last seven days", async () => {
    const fake = fakeClient(() => ({ data: null, error: null, count: 4 }));
    const now = new Date("2026-11-17T12:00:00Z");
    expect(await loadNewRegistrationCount(now, fake.client)).toBe(4);
    expect(NEW_REGISTRATION_DAYS).toBe(7);
    expect(fake.queries[0].calls).toContainEqual(["gte", "created_at", "2026-11-10T12:00:00.000Z"]);
    expect(fake.queries[0].calls[0]).toEqual(["select", "id", { count: "exact", head: true }]);
  });

  it("throws on a read error", async () => {
    const fake = fakeClient(() => ({ data: null, error: { code: "500" } }));
    await expect(loadNewRegistrationCount(new Date(), fake.client)).rejects.toThrow("count failed");
  });
});

describe("course form values", () => {
  const values = (changes: Partial<CourseValues> = {}): CourseValues => ({ ...courseValues(), slug: "a-course", ...changes });

  it("starts a new course as an in-person draft", () => {
    expect(courseValues()).toMatchObject({ type: "in_person", status: "draft", seats: "", date: "" });
  });

  it("reads a date and time in the browser's zone as UTC", () => {
    expect(toUtc("2026-12-01", "09:30")).toBe(new Date("2026-12-01T09:30").toISOString());
    expect(toUtc("2026-12-01", "")).toBeNull();
  });

  it("refuses a bad slug, a half date, a non-https link and bad seats", () => {
    expect(
      courseProblems(values({ slug: "a--b", date: "2026-12-01", onlineUrl: "http://x.test", seats: "0" })),
    ).toEqual({ slug: "slug", date: "dateTime", onlineUrl: "https", seats: "seats" });
    expect(courseProblems(values({ slug: "" })).slug).toBe("required");
    expect(courseProblems(values({ seats: "2.5" })).seats).toBe("seats");
  });

  it("refuses seats below the people already registered", () => {
    expect(courseProblems(values({ seats: "2" }), 3).seats).toBe("seatsBelow");
    expect(courseProblems(values({ seats: "3" }), 3).seats).toBeUndefined();
  });

  it("needs a title and description in one language, and a date for a scheduled type, to publish", () => {
    expect(courseProblems(values({ status: "published" }))).toEqual({
      titleAr: "publishText",
      descriptionAr: "publishText",
      titleEn: "publishText",
      descriptionEn: "publishText",
      date: "publishDate",
    });
    expect(
      courseProblems(values({ status: "published", type: "recorded", titleEn: "T", descriptionEn: "D" })),
    ).toEqual({});
    // A draft may miss everything but the slug.
    expect(courseProblems(values())).toEqual({});
  });

  it("creates with the filled fields only", () => {
    expect(
      createBody(values({ titleEn: " T ", descriptionEn: "D", date: "2026-12-01", time: "09:00", seats: "15" })),
    ).toEqual({
      slug: "a-course",
      type: "in_person",
      status: "draft",
      titleEn: "T",
      descriptionEn: "D",
      startsAt: new Date("2026-12-01T09:00").toISOString(),
      seats: 15,
    });
  });

  it("updates only what changed, and clears an emptied field with null", () => {
    const saved = courseValues(COURSE);
    expect(updateBody(COURSE, saved)).toBeNull();
    expect(updateBody(COURSE, { ...saved, seats: "25", placeEn: "" })).toEqual({
      id: ID,
      seats: 25,
      placeEn: null,
    });
    expect(updateBody(COURSE, { ...saved, seats: "" })).toEqual({ id: ID, seats: null });
  });

  it("keeps the stored start when the date and time are untouched", () => {
    const course = { ...COURSE, startsAt: "2026-12-01T09:00:42.000Z" };
    expect(updateBody(course, { ...courseValues(course), titleEn: "New" })).toEqual({ id: ID, titleEn: "New" });
  });

  it("previews the draft in one language, with seats left after the registrations", () => {
    const preview = previewCourse(courseValues(COURSE), "en", 3);
    expect(preview).toMatchObject({
      title: "Project management",
      place: "Amman",
      seats: 20,
      seatsLeft: 17,
      availableIn: ["ar", "en"],
    });
    expect(previewCourse({ ...courseValues(COURSE), descriptionAr: "" }, "ar", 0)).toBeNull();
    expect(previewCourse({ ...courseValues(COURSE), seats: "2" }, "en", 3)?.seatsLeft).toBe(0);
  });

  it("titles a course in the page language, or the other one", () => {
    expect(courseTitle(COURSE, "ar")).toBe("إدارة المشاريع");
    expect(courseTitle({ titleAr: " ", titleEn: "Only English" }, "ar")).toBe("Only English");
    expect(courseTitle({ titleAr: null, titleEn: null }, "en")).toBeNull();
  });
});

describe("CourseList", () => {
  it("shows status, type and seats taken out of the total", () => {
    withIntl(<CourseList courses={[COURSE, { ...COURSE, id: "c2", type: "recorded", seats: null, titleEn: null }]} locale="en" />);
    expect(screen.getByRole("link", { name: "Edit Project management" }).getAttribute("href")).toBe(
      `/dashboard/training/${ID}`,
    );
    expect(screen.getByText("3 of 20 taken")).toBeTruthy();
    expect(screen.getByText("None (recorded)")).toBeTruthy();
    expect(screen.getAllByText("Draft")).toHaveLength(2);
    // The second course has only an Arabic title.
    expect(screen.getByRole("link", { name: "Edit إدارة المشاريع" })).toBeTruthy();
  });

  it("renders in Arabic with the course's registrations link", () => {
    withIntl(<CourseList courses={[COURSE]} locale="ar" />, "ar");
    expect(screen.getByText("حضورية")).toBeTruthy();
    // The name starts with the visible text (label in name, WCAG 2.5.3).
    const link = screen.getByRole("link", { name: /^\S+ تسجيلات في إدارة المشاريع$/ });
    expect(link.getAttribute("aria-label")?.startsWith(link.textContent ?? "")).toBe(true);
    expect(link.getAttribute("href")).toBe(`/dashboard/training/registrations?course=${ID}`);
  });
});

describe("RegistrationList", () => {
  const row: RegistrationRow = {
    id: "r1",
    createdAt: "2026-11-10T08:00:00.000Z",
    clientId: "user_1",
    name: "<b>Sara</b>",
    email: "sara@example.com",
    courseId: ID,
    courseTitleAr: "عنوان",
    courseTitleEn: "Title",
  };

  it("links to the client page and renders names as text", () => {
    const { container } = withIntl(<RegistrationList registrations={[row]} locale="en" showCourse />);
    const link = screen.getByRole("link", { name: "Open <b>Sara</b>'s client page" });
    expect(link.getAttribute("href")).toBe("/dashboard/clients/user_1");
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("sara@example.com")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Title" })).toBeTruthy();
  });

  it("shows a hidden profile without a link, and leaves the course out of one course's list", () => {
    withIntl(<RegistrationList registrations={[{ ...row, name: null, email: null }]} locale="en" showCourse={false} />);
    expect(screen.getByText("Client not shown")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("RequestList", () => {
  const row: CustomRequestRow = {
    id: "q1",
    createdAt: "2026-11-11T10:00:00.000Z",
    orgName: "<script>alert(1)</script>",
    traineeCount: 12,
    topic: "<img src=x onerror=alert(1)>",
    suggestedDate: "2027-01-15",
    place: null,
    contactEmail: "org@example.com",
    clientId: null,
  };

  it("renders every field as text, never as HTML", () => {
    const { container } = withIntl(<RequestList requests={[row]} locale="en" />);
    expect(container.querySelector("script, img")).toBeNull();
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(screen.getByText("15 January 2027")).toBeTruthy();
    expect(screen.getByText("Not given")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("links to the sender's client page when RLS shows it", () => {
    withIntl(<RequestList requests={[{ ...row, clientId: "user_9" }]} locale="ar" />, "ar");
    expect(screen.getByRole("link", { name: "فتح صفحة العميل المرسِل" }).getAttribute("href")).toBe(
      "/dashboard/clients/user_9",
    );
  });
});

describe("CourseForm", () => {
  it("isolates the Latin slug example in the Arabic hint, so RTL keeps its order", () => {
    withIntl(<CourseForm />, "ar");
    const input = screen.getByLabelText(/اسم الرابط/);
    const hint = document.getElementById(input.getAttribute("aria-describedby")!.split(" ")[0]!);
    // FSI … PDI: the same isolation as <bdi>, inside the hint's plain text.
    expect(hint?.textContent).toBe("حروف وأرقام بينها شرطات، مثل \u2068project-management\u2069.");
  });

  it("refuses to send with errors, marking the fields", async () => {
    withIntl(<CourseForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Fix the marked fields, then save again.").getAttribute("role")).toBe("alert");
    expect(screen.getByText("Required.")).toBeTruthy();
  });

  it("clears a field's error and the alert once the field is edited", async () => {
    withIntl(<CourseForm />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    });
    expect(screen.getByText("Required.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: "a-course" } });
    expect(screen.queryByText("Required.")).toBeNull();
    expect(screen.queryByText("Fix the marked fields, then save again.")).toBeNull();
  });

  it("clears the date error when the time is edited", async () => {
    withIntl(<CourseForm />);
    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: "a-course" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-12-01" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    });
    expect(screen.getByText("Enter both a date and a time.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Start time"), { target: { value: "09:00" } });
    expect(screen.queryByText("Enter both a date and a time.")).toBeNull();
  });

  it("creates a course and opens it", async () => {
    fetchMock.mockImplementation(async () => json({ id: ID }));
    withIntl(<CourseForm />);
    fireEvent.change(screen.getByLabelText(/Link name/), { target: { value: "new-course" } });
    fireEvent.change(screen.getAllByLabelText("Title")[1], { target: { value: "New course" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create course" }));
    });
    expect(sent()).toEqual([
      {
        url: "/api/admin/courses",
        method: "POST",
        body: { slug: "new-course", type: "in_person", status: "draft", titleEn: "New course" },
      },
    ]);
    expect(router.push).toHaveBeenCalledWith(`/dashboard/training/${ID}`);
  });

  it("saves only the changed seats, and shows the server's refusal", async () => {
    fetchMock.mockImplementation(async () =>
      json({ error: { code: "conflict", message: "Someone else changed it." } }, 409),
    );
    withIntl(<CourseForm course={COURSE} />);
    fireEvent.change(screen.getByLabelText("Seats"), { target: { value: "30" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(sent()).toEqual([{ url: "/api/admin/courses", method: "PATCH", body: { id: ID, seats: 30 } }]);
    expect(screen.getByRole("alert").textContent).toBe("Someone else changed it.");
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("refuses seats below the registrations before sending", async () => {
    withIntl(<CourseForm course={COURSE} />);
    fireEvent.change(screen.getByLabelText("Seats"), { target: { value: "2" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Can't be below the 3 people already registered.")).toBeTruthy();
  });

  it("hides the date, seats and place for a recorded course", () => {
    withIntl(<CourseForm course={{ ...COURSE, type: "recorded" }} />, "ar");
    expect(screen.queryByLabelText("عدد المقاعد")).toBeNull();
    expect(screen.queryByLabelText("تاريخ البدء")).toBeNull();
    expect(screen.queryAllByLabelText("المكان")).toHaveLength(0);
  });

  it("shows the link field only for a live online course", () => {
    withIntl(<CourseForm course={{ ...COURSE, type: "online_live" }} />);
    expect(screen.getByLabelText("Session link")).toBeTruthy();
    expect(screen.queryAllByLabelText("Place")).toHaveLength(0);
  });

  it("offers the preview, closed until asked", () => {
    withIntl(<CourseForm course={COURSE} />);
    const toggle = screen.getByRole("button", { name: "Show preview" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
  });
});

describe("PublishToggle", () => {
  it("publishes a draft", async () => {
    withIntl(<PublishToggle id={ID} title="Project management" status="draft" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish Project management" }));
    });
    expect(sent()).toEqual([{ url: "/api/admin/courses", method: "PATCH", body: { id: ID, status: "published" } }]);
    expect(screen.getByRole("status").textContent).toBe("Published.");
    expect(router.refresh).toHaveBeenCalled();
  });

  it("shows the route's refusal, such as a missing date", async () => {
    fetchMock.mockImplementation(async () =>
      json({ error: { code: "validation_failed", message: "Set a date first." } }, 400),
    );
    withIntl(<PublishToggle id={ID} title="T" status="draft" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publish T" }));
    });
    expect(screen.getByRole("alert").textContent).toBe("Set a date first.");
  });
});

describe("DeleteCourse", () => {
  it("sends the id again as the confirmation", async () => {
    await deleteCourse(ID);
    expect(sent()).toEqual([{ url: `/api/admin/courses/${ID}`, method: "DELETE", body: { confirm: ID } }]);
  });

  it("asks twice, with the typed word, then deletes and goes back to the list", async () => {
    withIntl(<DeleteCourse id={ID} title="Project management" registrationCount={3} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete course" }));
    expect(
      screen.getByText(`Delete "Project management" and its 3 registrations? It leaves the site at once. This can't be undone.`),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const confirm = screen.getByRole("button", { name: "Delete for good" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "DELETE" } });
    await act(async () => fireEvent.click(confirm));
    expect(sent()).toEqual([{ url: `/api/admin/courses/${ID}`, method: "DELETE", body: { confirm: ID } }]);
    expect(router.push).toHaveBeenCalledWith("/dashboard/training");
  });
});

describe("CoursePreview", () => {
  it.each([
    ["ar", "مسجلة — قريباً"],
    ["en", "Recorded · Coming soon"],
  ] as const)("labels a recorded course with %s's separator", async (locale, eyebrow) => {
    const values: CourseValues = {
      ...courseValues(),
      slug: "a-course",
      type: "recorded",
      titleAr: "دورة",
      titleEn: "A course",
      descriptionAr: "وصف",
      descriptionEn: "A description",
    };
    withIntl(<CoursePreview values={values} registrationCount={0} />, locale);
    fireEvent.click(screen.getByRole("button", { name: (locale === "ar" ? ar : en).preview.show }));
    expect(await screen.findByText(eyebrow, {}, { timeout: 10000 })).toBeTruthy();
  });
});
