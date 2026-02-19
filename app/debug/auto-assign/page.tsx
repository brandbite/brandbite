// -----------------------------------------------------------------------------
// @file: app/debug/auto-assign/page.tsx
// @purpose: Debug/admin UI for managing auto-assign settings
// @version: v1.0.0
// @status: active
// @lastUpdate: 2025-11-20
// -----------------------------------------------------------------------------

"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAlert } from "@/components/ui/inline-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { FormSelect } from "@/components/ui/form-field";

type ProjectAutoAssignMode = "INHERIT" | "ON" | "OFF";

type AutoAssignOverviewProject = {
  id: string;
  name: string;
  code: string | null;
  autoAssignMode: ProjectAutoAssignMode;
};

type AutoAssignOverviewCompany = {
  id: string;
  name: string;
  slug: string;
  autoAssignDefaultEnabled: boolean;
  projects: AutoAssignOverviewProject[];
};

type AutoAssignOverviewResponse = {
  companies: AutoAssignOverviewCompany[];
};

type PanelState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; companies: AutoAssignOverviewCompany[] };

async function fetchOverview(): Promise<AutoAssignOverviewCompany[]> {
  const res = await fetch("/api/debug/auto-assign/overview", {
    method: "GET",
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json as any)?.error ??
      `Failed to load overview (status ${res.status})`;
    throw new Error(message);
  }

  return (json as AutoAssignOverviewResponse).companies;
}

async function updateCompanyAutoAssign(
  companyId: string,
  autoAssignDefaultEnabled: boolean,
) {
  const res = await fetch(
    `/api/debug/auto-assign/company/${encodeURIComponent(companyId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ autoAssignDefaultEnabled }),
    },
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json as any)?.error ??
      `Failed to update company (status ${res.status})`;
    throw new Error(message);
  }

  return json as { id: string; autoAssignDefaultEnabled: boolean };
}

async function updateProjectAutoAssignMode(
  projectId: string,
  mode: ProjectAutoAssignMode,
) {
  const res = await fetch(
    `/api/debug/auto-assign/project/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ autoAssignMode: mode }),
    },
  );

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (json as any)?.error ??
      `Failed to update project (status ${res.status})`;
    throw new Error(message);
  }

  return json as { id: string; autoAssignMode: ProjectAutoAssignMode };
}

function modeLabel(mode: ProjectAutoAssignMode): string {
  switch (mode) {
    case "INHERIT":
      return "Inherit company default";
    case "ON":
      return "Always on";
    case "OFF":
      return "Always off";
  }
}

export default function AutoAssignDebugPage() {
  const [state, setState] = useState<PanelState>({ status: "loading" });
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setState({ status: "loading" });

      try {
        const companies = await fetchOverview();
        if (cancelled) return;

        setState({ status: "ready", companies });
      } catch (err: any) {
        console.error("[AutoAssignDebug] load error", err);
        if (cancelled) return;

        setState({
          status: "error",
          message:
            err?.message ??
            "Failed to load auto-assign overview. Are you signed in as a site admin?",
        });
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = state.status === "loading";
  const isError = state.status === "error";
  const companies = state.status === "ready" ? state.companies : [];

  const handleToggleCompany = async (
    companyId: string,
    nextValue: boolean,
  ) => {
    setUpdatingKey(`company:${companyId}`);
    try {
      const updated = await updateCompanyAutoAssign(companyId, nextValue);
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        return {
          status: "ready",
          companies: prev.companies.map((c) =>
            c.id === updated.id
              ? {
                  ...c,
                  autoAssignDefaultEnabled:
                    updated.autoAssignDefaultEnabled,
                }
              : c,
          ),
        };
      });
    } catch (err: any) {
      console.error("[AutoAssignDebug] company update error", err);
      alert(
        err?.message ??
          "Failed to update company auto-assign setting. See console for details.",
      );
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleChangeProjectMode = async (
    projectId: string,
    mode: ProjectAutoAssignMode,
  ) => {
    setUpdatingKey(`project:${projectId}`);
    try {
      const updated = await updateProjectAutoAssignMode(projectId, mode);
      setState((prev) => {
        if (prev.status !== "ready") return prev;
        return {
          status: "ready",
          companies: prev.companies.map((c) => ({
            ...c,
            projects: c.projects.map((p) =>
              p.id === updated.id
                ? { ...p, autoAssignMode: updated.autoAssignMode }
                : p,
            ),
          })),
        };
      });
    } catch (err: any) {
      console.error("[AutoAssignDebug] project update error", err);
      alert(
        err?.message ??
          "Failed to update project auto-assign mode. See console for details.",
      );
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f3f0] px-6 py-10 text-[#424143]">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#b1afa9]">
              Debug panel
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Auto-assign configuration
            </h1>
            <p className="mt-1 text-xs text-[#9a9892]">
              Manage how tickets are automatically assigned to designers on each
              workspace and project. Only visible to site owners and admins.
            </p>
          </div>
          {isLoading && (
            <LoadingState display="inline" message="Loading overview…" />
          )}
        </header>

        {/* Error state */}
        {isError && (
          <InlineAlert variant="error" title="Something went wrong" className="mb-4">
            <p>{state.message}</p>
            <p className="mt-1 text-[11px] opacity-70">
              Make sure you&apos;re signed in as a{" "}
              <span className="font-medium">SITE_OWNER</span> or{" "}
              <span className="font-medium">SITE_ADMIN</span>.
            </p>
          </InlineAlert>
        )}

        {/* Empty state */}
        {!isError && !isLoading && companies.length === 0 && (
          <EmptyState title="No companies found in this environment." description="Once you seed demo data or create companies, they will appear in this panel." />
        )}

        {/* Companies list */}
        {!isError && companies.length > 0 && (
          <div className="space-y-4">
            {companies.map((company) => {
              const companyKey = `company:${company.id}`;
              const isCompanyUpdating = updatingKey === companyKey;

              return (
                <section
                  key={company.id}
                  className="rounded-2xl border border-[#e3e1dc] bg-white px-5 py-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#b1afa9]">
                        Workspace
                      </p>
                      <h2 className="text-sm font-semibold tracking-tight text-[#424143]">
                        {company.name}
                      </h2>
                      <p className="text-[11px] text-[#9a9892]">
                        slug:{" "}
                        <span className="font-mono text-[#7a7a7a]">
                          {company.slug}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex cursor-pointer items-center gap-2 text-xs text-[#7a7a7a]">
                        <span>Default auto-assign</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#c4c2bc]"
                          checked={company.autoAssignDefaultEnabled}
                          onChange={(e) =>
                            handleToggleCompany(
                              company.id,
                              e.target.checked,
                            )
                          }
                          disabled={isCompanyUpdating}
                        />
                      </label>
                      {isCompanyUpdating && (
                        <span className="text-[11px] text-[#9a9892]">
                          Saving…
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Projects */}
                  <div className="mt-4 border-t border-[#f1f0ea] pt-3">
                    <p className="mb-2 text-[11px] font-medium text-[#7a7a7a]">
                      Projects
                    </p>
                    {company.projects.length === 0 ? (
                      <EmptyState title="No projects found for this company." />
                    ) : (
                      <div className="space-y-2">
                        {company.projects.map((project) => {
                          const projectKey = `project:${project.id}`;
                          const isProjectUpdating =
                            updatingKey === projectKey;

                          return (
                            <div
                              key={project.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f8f6f2] px-3 py-2"
                            >
                              <div>
                                <p className="text-xs font-medium text-[#424143]">
                                  {project.name}
                                </p>
                                <p className="text-[11px] text-[#9a9892]">
                                  code:{" "}
                                  <span className="font-mono text-[#7a7a7a]">
                                    {project.code ?? "—"}
                                  </span>
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <FormSelect
                                  size="sm"
                                  className="w-auto"
                                  value={project.autoAssignMode}
                                  onChange={(e) =>
                                    handleChangeProjectMode(
                                      project.id,
                                      e.target
                                        .value as ProjectAutoAssignMode,
                                    )
                                  }
                                  disabled={isProjectUpdating}
                                >
                                  <option value="INHERIT">
                                    Inherit company default
                                  </option>
                                  <option value="ON">Always on</option>
                                  <option value="OFF">Always off</option>
                                </FormSelect>
                                {isProjectUpdating && (
                                  <span className="text-[11px] text-[#9a9892]">
                                    Saving…
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
