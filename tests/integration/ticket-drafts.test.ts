// -----------------------------------------------------------------------------
// @file: tests/integration/ticket-drafts.test.ts
// @purpose: Who can reach a request draft, and what submitting one does: it spends
//           tokens only then, its files become the request's, and it's gone after.
// -----------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetUser, mockDeleteR2 } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockDeleteR2: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUserOrThrow: () => mockGetUser(),
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn(),
  notifySiteOwnersOfEvent: vi.fn(),
}));
vi.mock("@/lib/r2", async (original) => ({
  ...(await original<typeof import("@/lib/r2")>()),
  deleteR2Objects: mockDeleteR2,
  resolveAssetUrl: async (key: string) => `https://files.test/${key}`,
}));

import { GET as adminList } from "@/app/api/admin/ticket-drafts/route";
import { DELETE as deleteAttachment } from "@/app/api/customer/ticket-drafts/[draftId]/attachments/[attachmentId]/route";
import {
  DELETE as deleteDraft,
  GET as getDraft,
  PATCH as patchDraft,
} from "@/app/api/customer/ticket-drafts/[draftId]/route";
import { GET as listDrafts, POST as createDraft } from "@/app/api/customer/ticket-drafts/route";
import { POST as createTicket } from "@/app/api/customer/tickets/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "./helpers/db";
import { addCompanyMember, createCompany, createJobType, createUser } from "./helpers/fixtures";

function jsonReq(method: string, body?: unknown) {
  return new NextRequest("http://localhost/test", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const params = (draftId: string) => ({ params: Promise.resolve({ draftId }) });

function actAs(user: { id: string }, companyId: string | null, role = "CUSTOMER") {
  mockGetUser.mockResolvedValue({
    id: user.id,
    email: `${user.id}@test.local`,
    role,
    activeCompanyId: companyId,
    companyRole: companyId ? "OWNER" : null,
  });
}

async function seedCustomer(tokenBalance = 0) {
  const company = await createCompany({ tokenBalance });
  const author = await createUser({ role: "CUSTOMER" });
  await addCompanyMember(company.id, author.id, "OWNER");
  return { company, author };
}

async function seedDraft(args: { companyId: string; userId: string; jobTypeId?: string }) {
  return prisma.ticketDraft.create({
    data: {
      companyId: args.companyId,
      createdById: args.userId,
      title: "Espresso launch post",
      description: "<p>Warm, moody</p>",
      fields: { jobTypeId: args.jobTypeId ?? "" },
      attachments: {
        create: {
          storageKey: "ticket-drafts/x/logo.png",
          mimeType: "image/png",
          bytes: 1200,
          originalName: "logo.png",
        },
      },
    },
    include: { attachments: true },
  });
}

beforeEach(async () => {
  await resetDatabase();
  mockGetUser.mockReset();
  mockDeleteR2.mockReset();
});

describe("saving a draft", () => {
  it("saves an unfinished request without spending tokens or creating a ticket", async () => {
    const { company, author } = await seedCustomer(0);
    actAs(author, company.id);

    const res = await createDraft(jsonReq("POST", { title: "Half a thought" }));
    expect(res.status).toBe(201);

    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.tokenLedger.count()).toBe(0);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.tokenBalance).toBe(0);
  });

  it("keeps fields across a save and hands them back to the form", async () => {
    const { company, author } = await seedCustomer();
    actAs(author, company.id);
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    const res = await patchDraft(
      jsonReq("PATCH", {
        title: "New title",
        description: "<p>More</p>",
        priority: "HIGH",
        quantity: 3,
        tagIds: ["t1"],
      }),
      params(draft.id),
    );
    expect(res.status).toBe(200);

    const json = await (await getDraft(jsonReq("GET"), params(draft.id))).json();
    expect(json.draft).toMatchObject({
      title: "New title",
      description: "<p>More</p>",
      priority: "HIGH",
      quantity: 3,
      tagIds: ["t1"],
    });
    expect(json.draft.attachments[0].originalName).toBe("logo.png");
    expect(json.draft.attachments[0].storageKey).toBeUndefined();
  });

  it("refuses a billing-only member", async () => {
    const { company } = await seedCustomer();
    const billing = await createUser({ role: "CUSTOMER" });
    mockGetUser.mockResolvedValue({
      id: billing.id,
      email: "b@test.local",
      role: "CUSTOMER",
      activeCompanyId: company.id,
      companyRole: "BILLING",
    });

    const res = await createDraft(jsonReq("POST", { title: "Nope" }));
    expect(res.status).toBe(403);
  });
});

describe("who can reach a draft", () => {
  it("hides it from a colleague in the same company", async () => {
    const { company, author } = await seedCustomer();
    const colleague = await createUser({ role: "CUSTOMER" });
    await addCompanyMember(company.id, colleague.id, "OWNER");
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(colleague, company.id);
    expect((await (await listDrafts()).json()).drafts).toHaveLength(0);
    expect((await getDraft(jsonReq("GET"), params(draft.id))).status).toBe(404);
    expect((await patchDraft(jsonReq("PATCH", { title: "x" }), params(draft.id))).status).toBe(404);
    expect((await deleteDraft(jsonReq("DELETE"), params(draft.id))).status).toBe(404);
    expect(await prisma.ticketDraft.count()).toBe(1);
  });

  it("hides it from its author once they're in another company", async () => {
    const { company, author } = await seedCustomer();
    const other = await createCompany();
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(author, other.id);
    expect((await getDraft(jsonReq("GET"), params(draft.id))).status).toBe(404);
  });

  it("won't remove a file through someone else's draft", async () => {
    const { company, author } = await seedCustomer();
    const colleague = await createUser({ role: "CUSTOMER" });
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(colleague, company.id);
    const res = await deleteAttachment(jsonReq("DELETE"), {
      params: Promise.resolve({ draftId: draft.id, attachmentId: draft.attachments[0].id }),
    });
    expect(res.status).toBe(404);
    expect(await prisma.ticketDraftAttachment.count()).toBe(1);
    expect(mockDeleteR2).not.toHaveBeenCalled();
  });

  it("shows admins every draft, and gives them no way to change one", async () => {
    const { company, author } = await seedCustomer();
    const jobType = await createJobType();
    const draft = await seedDraft({
      companyId: company.id,
      userId: author.id,
      jobTypeId: jobType.id,
    });
    const admin = await createUser({ role: "SITE_ADMIN" });

    actAs(admin, null, "SITE_ADMIN");
    const json = await (await adminList()).json();
    expect(json.drafts).toHaveLength(1);
    expect(json.drafts[0]).toMatchObject({
      id: draft.id,
      companyName: company.name,
      jobTypeName: jobType.name,
    });
    expect(json.drafts[0].attachments[0].url).toBe("https://files.test/ticket-drafts/x/logo.png");

    expect((await patchDraft(jsonReq("PATCH", { title: "x" }), params(draft.id))).status).toBe(404);
    expect((await deleteDraft(jsonReq("DELETE"), params(draft.id))).status).toBe(404);
  });

  it("refuses the admin list to customers and creatives", async () => {
    const { company, author } = await seedCustomer();
    actAs(author, company.id);
    expect((await adminList()).status).toBe(403);

    const creative = await createUser({ role: "DESIGNER" });
    actAs(creative, null, "DESIGNER");
    expect((await adminList()).status).toBe(403);
  });
});

describe("deleting a draft", () => {
  it("removes the draft and its stored files", async () => {
    const { company, author } = await seedCustomer();
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(author, company.id);
    expect((await deleteDraft(jsonReq("DELETE"), params(draft.id))).status).toBe(200);

    expect(await prisma.ticketDraft.count()).toBe(0);
    expect(await prisma.ticketDraftAttachment.count()).toBe(0);
    expect(mockDeleteR2).toHaveBeenCalledWith(["ticket-drafts/x/logo.png"]);
  });
});

describe("submitting a draft", () => {
  it("charges only now, moves its files to the request and removes the draft", async () => {
    const { company, author } = await seedCustomer(50);
    const jobType = await createJobType();
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(author, company.id);
    const res = await createTicket(
      jsonReq("POST", { title: "Espresso launch post", jobTypeId: jobType.id, draftId: draft.id }),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.draftMoved).toBe(true);

    const assets = await prisma.asset.findMany({ where: { ticketId: json.ticket.id } });
    expect(assets).toHaveLength(1);
    expect(assets[0]).toMatchObject({
      kind: "BRIEF_INPUT",
      storageKey: "ticket-drafts/x/logo.png",
      originalName: "logo.png",
    });
    expect(await prisma.ticketDraft.count()).toBe(0);
    // The file now belongs to the request, so it must stay in storage.
    expect(mockDeleteR2).not.toHaveBeenCalled();

    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.tokenBalance).toBeLessThan(50);
  });

  it("keeps the draft when the balance can't cover it", async () => {
    const { company, author } = await seedCustomer(0);
    const jobType = await createJobType();
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(author, company.id);
    const res = await createTicket(
      jsonReq("POST", { title: "Espresso launch post", jobTypeId: jobType.id, draftId: draft.id }),
    );
    expect(res.status).toBe(402);

    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.ticketDraft.count()).toBe(1);
    expect(await prisma.ticketDraftAttachment.count()).toBe(1);
  });

  it("won't take a colleague's draft, and charges nothing trying", async () => {
    const { company, author } = await seedCustomer(50);
    const colleague = await createUser({ role: "CUSTOMER" });
    await addCompanyMember(company.id, colleague.id, "OWNER");
    const jobType = await createJobType();
    const draft = await seedDraft({ companyId: company.id, userId: author.id });

    actAs(colleague, company.id);
    const res = await createTicket(
      jsonReq("POST", { title: "Mine now", jobTypeId: jobType.id, draftId: draft.id }),
    );
    expect(res.status).toBe(400);

    expect(await prisma.ticket.count()).toBe(0);
    expect(await prisma.ticketDraft.count()).toBe(1);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.id } });
    expect(after.tokenBalance).toBe(50);
  });
});
