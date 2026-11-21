// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lib/content/courses";
import arListing from "@/messages/ar/PublicListing.json";
import ar from "@/messages/ar/Training.json";
import enListing from "@/messages/en/PublicListing.json";
import en from "@/messages/en/Training.json";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  user: null as { primaryEmailAddress: { emailAddress: string } } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn() }));
vi.mock("@/components/clerk/auth-state", () => ({
  useAuthState: () => ({
    isLoaded: true,
    isSignedIn: Boolean(mocks.user),
    email: mocks.user?.primaryEmailAddress?.emailAddress ?? null,
  }),
}));
vi.mock("@/lib/supabase/user", () => ({ createUserClient: vi.fn() }));
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }));
vi.mock("next/cache", () => ({ cacheTag: vi.fn(), cacheLife: vi.fn() }));
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "ar" | "en"; namespace: "Training" }) =>
    createTranslator({ locale, namespace, messages: { Training: locale === "ar" ? ar : en } }),
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  Link: ({
    href,
    children,
    scroll: _scroll,
    ...rest
  }: {
    href: string | { pathname: string; query?: Record<string, string> };
    children: ReactNode;
    scroll?: boolean;
  }) => {
    void _scroll;
    const url =
      typeof href === "string"
        ? href
        : `${href.pathname}${Object.keys(href.query ?? {}).length ? `?${new URLSearchParams(href.query)}` : ""}`;
    return (
      <a href={url} {...rest}>
        {children}
      </a>
    );
  },
}));

const track = vi.hoisted(() => vi.fn());
const route = vi.hoisted(() => ({ params: { slug: "governance-basics" } as { slug?: string } }));
vi.mock("@/lib/analytics/track", () => ({ track }));
vi.mock("next/navigation", () => ({ useParams: () => route.params }));

const { CourseList } = await import("./course-list");
const { CustomRequestForm } = await import("./custom-request-form");
const { parseTypeFilter, readMyCourses, readViewer } = await import("./data");
const { coursePath, CUSTOM_TRAINING_PATH } = await import("./paths");
const { RegisterButton } = await import("./register-button");
const { RegistrationPanel } = await import("./registration-panel");

const MESSAGES = {
  ar: { Training: ar, PublicListing: arListing },
  en: { Training: en, PublicListing: enListing },
};
const NOW = new Date("2027-01-01T00:00:00.000Z");
const COURSE_ID = "123e4567-e89b-42d3-a456-426614174000";

const course = (rest: Partial<Course> = {}): Course => ({
  id: COURSE_ID,
  slug: "governance-basics",
  type: "in_person",
  title: "Governance basics",
  description: "About the course",
  audience: null,
  startsAt: "2027-03-01T09:00:00.000Z",
  place: "Aden",
  seats: 10,
  seatsLeft: 4,
  ...rest,
});

function show(node: ReactNode, locale: "ar" | "en" = "en") {
  return render(
    <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
      {node}
    </NextIntlClientProvider>,
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  mocks.refresh.mockReset();
  mocks.user = null;
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** A supabase-js stand-in: each table answers its fixture and records the filters. */
function fakeClient(tables: Record<string, unknown[] | { code: string }>) {
  const calls: { table: string; columns: string; filters: unknown[][] }[] = [];
  const client = {
    from(table: string) {
      const call = { table, columns: "", filters: [] as unknown[][] };
      calls.push(call);
      const answer = () => {
        const fixture = tables[table] ?? [];
        return Array.isArray(fixture) ? { data: fixture, error: null } : { data: null, error: fixture };
      };
      const builder: Record<string, unknown> = {
        select: (columns: string) => ((call.columns = columns), builder),
        eq: (...args: unknown[]) => (call.filters.push(["eq", ...args]), builder),
        in: (...args: unknown[]) => (call.filters.push(["in", ...args]), builder),
        order: () => builder,
        maybeSingle: async () => {
          const { data, error } = answer();
          return { data: data?.[0] ?? null, error };
        },
        then: (resolve: (value: unknown) => unknown) => resolve(answer()),
      };
      return builder;
    },
  };
  return { client: client as never, calls };
}

describe("readViewer", () => {
  function deps(userId: string | null, userTables: Record<string, unknown[]>, online: string | null = null) {
    const user = fakeClient(userTables);
    const service = fakeClient({ courses: [{ online_url: online }] });
    return {
      user,
      service,
      deps: { getUserId: async () => userId, user: () => user.client, service: () => service.client },
    };
  }

  it("a visitor is signed out, and nothing is read", async () => {
    const d = deps(null, {});
    expect(await readViewer(COURSE_ID, d.deps)).toEqual({ kind: "signed_out" });
    expect(d.user.calls).toEqual([]);
    expect(d.service.calls).toEqual([]);
  });

  it("a signed-in user with no profile hasn't finished onboarding", async () => {
    const d = deps("user_1", { profiles: [] });
    expect(await readViewer(COURSE_ID, d.deps)).toEqual({ kind: "no_profile" });
  });

  it("a team member is not a client", async () => {
    const d = deps("user_1", { profiles: [{ role_id: "role" }] });
    expect(await readViewer(COURSE_ID, d.deps)).toEqual({ kind: "team" });
    expect(d.service.calls).toEqual([]);
  });

  it("a client who isn't registered never gets the link: the service client isn't used", async () => {
    const d = deps("user_1", { profiles: [{ role_id: null }], course_registrations: [] }, "https://meet.example/x");
    expect(await readViewer(COURSE_ID, d.deps)).toEqual({ kind: "client", registered: false, onlineUrl: null });
    expect(d.service.calls).toEqual([]);
  });

  it("a registered client gets the link, read by course id after their own row proved it", async () => {
    const d = deps(
      "user_1",
      { profiles: [{ role_id: null }], course_registrations: [{ id: "r1" }] },
      "https://meet.example/x",
    );
    expect(await readViewer(COURSE_ID, d.deps)).toEqual({
      kind: "client",
      registered: true,
      onlineUrl: "https://meet.example/x",
    });
    // Their own rows, through their own token.
    expect(d.user.calls[0]).toMatchObject({ table: "profiles", filters: [["eq", "clerk_user_id", "user_1"]] });
    expect(d.user.calls[1]).toMatchObject({
      table: "course_registrations",
      filters: [
        ["eq", "course_id", COURSE_ID],
        ["eq", "client_id", "user_1"],
      ],
    });
    expect(d.service.calls).toEqual([
      { table: "courses", columns: "online_url", filters: [["eq", "id", COURSE_ID]] },
    ]);
  });

  it.each(["http://meet.example/x", "javascript:alert(1)", "not a link", null])(
    "a stored link %j that isn't https is not passed on",
    async (stored) => {
      const d = deps("user_1", { profiles: [{ role_id: null }], course_registrations: [{ id: "r1" }] }, stored);
      expect(await readViewer(COURSE_ID, d.deps)).toMatchObject({ registered: true, onlineUrl: null });
    },
  );
});

describe("readMyCourses", () => {
  const row = (id: string, rest: Record<string, unknown> = {}) => ({
    id,
    slug: id,
    type: "online_live",
    title_ar: `دورة ${id}`,
    title_en: `Course ${id}`,
    starts_at: "2027-03-01T09:00:00+00:00",
    place_ar: null,
    place_en: null,
    online_url: "https://meet.example/x",
    status: "published",
    ...rest,
  });

  it("reads the client's own registrations with their token, then those courses only", async () => {
    const user = fakeClient({
      course_registrations: [
        { id: "r1", course_id: "later", created_at: "2026-12-01T10:00:00+00:00" },
        { id: "r2", course_id: "sooner", created_at: "2026-12-02T10:00:00+00:00" },
        { id: "r3", course_id: "undated", created_at: "2026-12-03T10:00:00+00:00" },
        { id: "r4", course_id: "hidden", created_at: "2026-12-04T10:00:00+00:00" },
        { id: "r5", course_id: "gone", created_at: "2026-12-05T10:00:00+00:00" },
      ],
    });
    const service = fakeClient({
      courses: [
        row("later", { starts_at: "2027-06-01T09:00:00+00:00" }),
        row("sooner", { starts_at: "2027-02-01T09:00:00+00:00", title_en: null, type: "in_person", place_ar: "عدن", online_url: null }),
        row("undated", { starts_at: null, type: "recorded" }),
        row("hidden", { status: "draft", online_url: "http://plain.example" }),
      ],
    });
    const list = await readMyCourses("user_1", "en", { user: () => user.client, service: () => service.client });

    expect(user.calls[0]).toMatchObject({
      table: "course_registrations",
      filters: [["eq", "client_id", "user_1"]],
    });
    expect(service.calls[0]?.filters).toEqual([["in", "id", ["later", "sooner", "undated", "hidden", "gone"]]]);
    // Soonest first, then the undated one. A deleted course is left out.
    expect(list.map((item) => item.courseId)).toEqual(["sooner", "hidden", "later", "undated"]);
    expect(list[0]).toEqual({
      id: "r2",
      courseId: "sooner",
      slug: "sooner",
      type: "in_person",
      // The other language's title and place stand in.
      title: "دورة sooner",
      startsAt: "2027-02-01T09:00:00.000Z",
      place: "عدن",
      onlineUrl: null,
      registeredAt: "2026-12-02T10:00:00.000Z",
    });
    // An unpublished course has no public page; a link that isn't https is dropped.
    expect(list[1]).toMatchObject({ courseId: "hidden", slug: null, onlineUrl: null });
    expect(list[2]?.onlineUrl).toBe("https://meet.example/x");
  });

  it("no registrations: no course read at all", async () => {
    const user = fakeClient({ course_registrations: [] });
    const service = fakeClient({});
    expect(await readMyCourses("user_1", "ar", { user: () => user.client, service: () => service.client })).toEqual([]);
    expect(service.calls).toEqual([]);
  });

  it("throws on a read error, with the code only", async () => {
    const user = fakeClient({ course_registrations: { code: "42501" } });
    await expect(
      readMyCourses("user_1", "ar", { user: () => user.client, service: () => fakeClient({}).client }),
    ).rejects.toThrow("own registrations read failed: 42501");
  });
});

describe("RegistrationPanel", () => {
  const panel = async (
    viewer: Parameters<typeof RegistrationPanel>[0]["viewer"],
    rest: Partial<Course> = {},
    locale: "ar" | "en" = "en",
  ) => show(await RegistrationPanel({ course: course(rest), locale, viewer, now: NOW }), locale);
  const CLIENT = { kind: "client", registered: false, onlineUrl: null } as const;

  it("an open course shows a client the register button", async () => {
    await panel(CLIENT);
    expect(screen.getByRole("button", { name: en.register.button })).toBeTruthy();
  });

  it("a signed-out visitor gets a sign-in link that comes back to this course", async () => {
    await panel({ kind: "signed_out" }, {}, "ar");
    const link = screen.getByRole("link", { name: ar.register.signIn });
    expect(link.getAttribute("href")).toBe(
      `/ar/sign-in?redirect_url=${encodeURIComponent("/ar/training/governance-basics")}`,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a user who hasn't onboarded goes to onboarding, and back", async () => {
    await panel({ kind: "no_profile" });
    expect(screen.getByRole("link", { name: en.register.completeProfile }).getAttribute("href")).toBe(
      `/en/onboarding?redirect_url=${encodeURIComponent("/en/training/governance-basics")}`,
    );
  });

  it("a team member is told registration is for clients", async () => {
    await panel({ kind: "team" });
    expect(screen.getByText(en.register.teamOnly)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([{ kind: "signed_out" }, CLIENT, { kind: "team" }] as const)(
    "a full course shows $kind a disabled اكتملت المقاعد and no way to register",
    async (viewer) => {
      await panel(viewer, { seatsLeft: 0 }, "ar");
      const full = screen.getByRole("button", { name: "اكتملت المقاعد" }) as HTMLButtonElement;
      expect(full.disabled).toBe(true);
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("a recorded course says coming soon and offers nothing", async () => {
    await panel(CLIENT, { type: "recorded", startsAt: null, seats: null, seatsLeft: null });
    expect(screen.getByText(en.register.soon)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it.each([{ kind: "signed_out" }, CLIENT, { kind: "team" }] as const)(
    "a past course shows $kind انتهت الدورة and no way to register",
    async (viewer) => {
      await panel(viewer, { startsAt: "2026-11-06T09:00:00.000Z", seatsLeft: 0 }, "ar");
      expect(screen.getByText("انتهت الدورة.")).toBeTruthy();
      expect(screen.queryByText(ar.register.full)).toBeNull();
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.queryByRole("link")).toBeNull();
    },
  );

  it("a past course says it has ended in English", async () => {
    await panel(CLIENT, { startsAt: "2026-11-06T09:00:00.000Z" });
    expect(screen.getByText("This course has ended.")).toBeTruthy();
  });

  it("a client registered for a past course still sees their registration", async () => {
    await panel({ kind: "client", registered: true, onlineUrl: null }, { startsAt: "2026-11-06T09:00:00.000Z" });
    expect(screen.getByText(en.register.registered)).toBeTruthy();
    expect(screen.queryByText(en.register.ended)).toBeNull();
  });

  it("a course with no date is closed", async () => {
    await panel(CLIENT, { startsAt: null });
    expect(screen.getByText(en.register.closed)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a custom course points to the custom training form", async () => {
    await panel({ kind: "signed_out" }, { type: "custom" });
    expect(screen.getByRole("link", { name: en.custom.linkFromCourse }).getAttribute("href")).toBe(
      CUSTOM_TRAINING_PATH,
    );
  });

  it("a registered client sees that first, with the session's link, even when the course is full or over", async () => {
    await panel(
      { kind: "client", registered: true, onlineUrl: "https://meet.example/x" },
      { type: "online_live", seatsLeft: 0, startsAt: "2026-12-01T09:00:00.000Z" },
    );
    expect(screen.getByRole("status").textContent).toBe(en.register.registered);
    const link = screen.getByRole("link", { name: new RegExp(en.course.openLink) });
    expect(link.getAttribute("href")).toBe("https://meet.example/x");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: en.register.myCourses }).getAttribute("href")).toBe("/account/courses");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("a registered client of an in-person course sees no link", async () => {
    await panel({ kind: "client", registered: true, onlineUrl: null });
    expect(screen.queryByRole("link", { name: new RegExp(en.course.openLink) })).toBeNull();
  });
});

describe("RegisterButton", () => {
  const click = () => fireEvent.click(screen.getByRole("button", { name: en.register.button }));

  it("posts to the course's register route with no body, then refreshes the page", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ outcome: "registered", seatsLeft: 3 }), { status: 200 }),
    );
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(en.register.justRegistered));
    expect(fetchMock).toHaveBeenCalledWith(`/api/courses/${COURSE_ID}/register`, { method: "POST" });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows the server's message when the last seat went to someone else, and refreshes", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "course_full", message: "اكتملت المقاعد" } }), { status: 409 }),
    );
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("اكتملت المقاعد"));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("shows its own text for an unreadable answer or a network failure", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 502 }));
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.register.failed));
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.register.networkError));
  });
});

describe("CourseList", () => {
  const courses = [
    course({ id: "a", slug: "in-person" }),
    course({ id: "b", slug: "full", type: "online_live", seats: 2, seatsLeft: 0, place: null }),
    course({ id: "c", slug: "recorded", type: "recorded", startsAt: null, seats: null, seatsLeft: null }),
  ];

  it("shows a chip per type that has a course, and every course", () => {
    show(<CourseList courses={courses} type={null} />);
    const chips = within(screen.getByRole("navigation", { name: en.typeFilter })).getAllByRole("link");
    expect(chips.map((chip) => chip.getAttribute("href"))).toEqual([
      "/training",
      "/training?type=in_person",
      "/training?type=online_live",
      "/training?type=recorded",
    ]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("a recorded course shows قريباً and no button; a full one اكتملت المقاعد; the other a link to its page", () => {
    show(<CourseList courses={courses} type={null} />, "ar");
    const [open, full, recorded] = screen.getAllByRole("article");
    expect(within(open!).getByRole("link", { name: ar.viewCourse }).getAttribute("href")).toBe("/training/in-person");
    expect((within(full!).getByRole("button", { name: "اكتملت المقاعد" }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(full!).queryByRole("link", { name: ar.viewCourse })).toBeNull();
    expect(within(recorded!).getByText("قريباً")).toBeTruthy();
    expect(within(recorded!).queryByRole("link", { name: ar.viewCourse })).toBeNull();
    expect(within(recorded!).queryByRole("meter")).toBeNull();
  });

  it("filters by type, and says so when nothing matches", () => {
    show(<CourseList courses={courses} type="recorded" />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    cleanup();
    show(<CourseList courses={courses.slice(0, 1)} type="recorded" />);
    expect(screen.getByText(en.emptyFiltered)).toBeTruthy();
    // The active filter keeps its chips, so "All" can clear it.
    const chips = within(screen.getByRole("navigation", { name: en.typeFilter })).getAllByRole("link");
    expect(chips.map((chip) => chip.getAttribute("href"))).toEqual([
      "/training",
      "/training?type=in_person",
      "/training?type=recorded",
    ]);
    cleanup();
    show(<CourseList courses={[]} type={null} />);
    expect(screen.getByText(en.empty)).toBeTruthy();
    // One type, or none: no chips.
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("shows a card's date in the visitor's zone, not UTC", () => {
    const startsAt = "2027-03-01T00:30:00Z";
    show(<CourseList courses={[course({ startsAt })]} type={null} />);
    const local = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date(startsAt));
    expect(screen.getByRole("article").querySelector(`time[datetime="${startsAt}"]`)?.textContent).toBe(local);
  });

  it("renders a title as text, never as markup", () => {
    show(<CourseList courses={[course({ title: '<img src=x onerror="alert(1)">' })]} type={null} />);
    expect(document.querySelector("img")).toBeNull();
  });
});

describe("CustomRequestForm", () => {
  const VALID = {
    orgName: "Sample Foundation",
    topic: "Project management",
    traineeCount: "25",
    suggestedDate: "2027-04-10",
    place: "",
    contactEmail: "training@example.com",
  };
  function fill(values: Partial<typeof VALID>) {
    for (const [name, value] of Object.entries(values)) {
      fireEvent.change(document.querySelector<HTMLInputElement>(`[name="${name}"]`)!, { target: { value } });
    }
  }
  const submit = () => fireEvent.submit(document.querySelector("form")!);

  it("sends the request as text, the count as a number, and an empty place left out", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 201 }));
    show(<CustomRequestForm />);
    fill({ ...VALID, topic: "<b>Project</b> management" });
    submit();
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain(en.custom.sentTitle));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/training/custom-requests");
    expect(JSON.parse(String(init.body))).toEqual({
      orgName: "Sample Foundation",
      topic: "<b>Project</b> management",
      traineeCount: 25,
      suggestedDate: "2027-04-10",
      contactEmail: "training@example.com",
    });
    // No promise about when an answer comes (§6.14).
    expect(screen.getByRole("status").textContent).not.toMatch(/soon|within|hours|days/i);
  });

  it("fills a signed-in visitor's email in, and never over what was typed", () => {
    mocks.user = { primaryEmailAddress: { emailAddress: "mona@example.com" } };
    show(<CustomRequestForm />);
    const field = document.querySelector<HTMLInputElement>('[name="contactEmail"]')!;
    expect(field.value).toBe("mona@example.com");
    expect(field.dir).toBe("ltr");
    cleanup();
    mocks.user = null;
    show(<CustomRequestForm />);
    expect(document.querySelector<HTMLInputElement>('[name="contactEmail"]')!.value).toBe("");
  });

  it("names each missing or wrong field, focuses the first, and sends nothing", () => {
    show(<CustomRequestForm />);
    submit();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      en.custom.required,
      en.custom.required,
      en.custom.required,
      en.custom.required,
      en.custom.required,
    ]);
    expect(document.activeElement?.getAttribute("name")).toBe("orgName");
    fill({ ...VALID, traineeCount: "0", contactEmail: "nope" });
    submit();
    expect(screen.getAllByRole("alert").map((alert) => alert.textContent)).toEqual([
      en.custom.countInvalid,
      en.custom.emailInvalid,
    ]);
    expect(document.activeElement?.getAttribute("name")).toBe("traineeCount");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's refusal and keeps what was typed", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "rate_limited", message: "Try later." } }), { status: 429 }),
    );
    show(<CustomRequestForm />);
    fill(VALID);
    submit();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Try later."));
    expect(document.querySelector<HTMLInputElement>('[name="orgName"]')!.value).toBe("Sample Foundation");
  });
});

describe("paths and the type filter", () => {
  it("reads only a known type from the query", () => {
    expect(parseTypeFilter("recorded")).toBe("recorded");
    expect(parseTypeFilter(["online_live", "recorded"])).toBe("online_live");
    expect(parseTypeFilter("webinar")).toBeNull();
    expect(parseTypeFilter(undefined)).toBeNull();
  });

  it("encodes a slug in the course path", () => {
    expect(coursePath("governance-basics")).toBe("/training/governance-basics");
    expect(coursePath("أساسيات-الحوكمة")).toBe(`/training/${encodeURIComponent("أساسيات-الحوكمة")}`);
  });

  it("has the same keys in both languages", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? keys(inner as object, `${prefix}${key}.`) : `${prefix}${key}`,
      );
    expect(keys(ar)).toEqual(keys(en));
    expect(ar.register.full).toBe("اكتملت المقاعد");
    expect(ar.account.title).toBe("دوراتي");
  });
});

describe("RegisterButton analytics", () => {
  const click = () => fireEvent.click(screen.getByRole("button", { name: en.register.button }));
  const answer = (outcome: string) =>
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ outcome, seatsLeft: 3 }), { status: 200 }));

  beforeEach(() => {
    track.mockClear();
    route.params = { slug: "governance-basics" };
  });

  it("sends course_registered once for a new registration, with the course's slug", async () => {
    answer("registered");
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(en.register.justRegistered));
    expect(track).toHaveBeenCalledExactlyOnceWith("course_registered", { course_slug: "governance-basics" });
  });

  it("decodes an Arabic slug, and leaves out one that isn't a slug", async () => {
    answer("registered");
    route.params = { slug: encodeURIComponent("أساسيات-الحوكمة") };
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(track).toHaveBeenCalledWith("course_registered", { course_slug: "أساسيات-الحوكمة" }));
    cleanup();
    track.mockClear();
    route.params = { slug: "a b<script>" };
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(track).toHaveBeenCalledWith("course_registered", {}));
  });

  it("sends nothing when already registered, refused or offline", async () => {
    answer("already_registered");
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("status")).toBeTruthy());
    cleanup();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "course_full", message: "Full" } }), { status: 409 }),
    );
    show(<RegisterButton courseId={COURSE_ID} />);
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Full"));
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    click();
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe(en.register.networkError));
    expect(track).not.toHaveBeenCalled();
  });
});
