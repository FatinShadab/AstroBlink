import { describe, it, expect, beforeEach } from "vitest";
import { ALL_PICTURE_COUNT, PROJECTS, getPicture, observatoryHref, picturesFor } from "@/lib/mock/projectCatalog";
import { addContribution, contributedPictureIds, listContributions } from "@/lib/contributions";
import { validateCredentials, signInLocally, readSession, signOutLocally } from "@/lib/auth/session";

describe("project catalogue", () => {
  it("gives every project two fields per benchmark target", () => {
    for (const p of PROJECTS) {
      expect(picturesFor(p.id)).toHaveLength(p.targetIds.length * 2);
    }
  });

  it("counts every picture across projects", () => {
    expect(ALL_PICTURE_COUNT).toBe(PROJECTS.reduce((n, p) => n + p.targetIds.length * 2, 0));
  });

  it("resolves a picture id back to its field", () => {
    const pic = picturesFor("brown-dwarf-census")[0];
    expect(getPicture(pic.id)).toEqual(pic);
    expect(getPicture("nope")).toBeUndefined();
  });

  it("links to the observatory with project and picture context", () => {
    const pic = picturesFor("brown-dwarf-census")[0];
    const href = observatoryHref(pic);
    expect(href.startsWith("/observatory?")).toBe(true);
    const qs = new URLSearchParams(href.split("?")[1]);
    expect(qs.get("project")).toBe("brown-dwarf-census");
    expect(qs.get("subject")).toBe(pic.id);
    expect(Number(qs.get("fov"))).toBe(pic.fovArcmin);
  });
});

describe("contribution store", () => {
  beforeEach(() => window.localStorage.clear());

  it("records contributions per user and project", () => {
    addContribution({ userId: "u1", projectId: "p1", pictureId: "a", category: "fast_mover", ra: 1, dec: 2 });
    addContribution({ userId: "u2", projectId: "p1", pictureId: "b", category: "fast_mover", ra: 1, dec: 2 });
    addContribution({ userId: "u1", projectId: "p2", pictureId: "c", category: "fast_mover", ra: 1, dec: 2 });
    expect(listContributions("u1")).toHaveLength(2);
    expect([...contributedPictureIds("u1", "p1")]).toEqual(["a"]);
  });

  it("survives corrupt storage without throwing", () => {
    window.localStorage.setItem("astroblink.contributions.v1", "{not json");
    expect(listContributions()).toEqual([]);
  });
});

describe("local session", () => {
  beforeEach(() => window.localStorage.clear());

  it("validates email and password length", () => {
    expect(validateCredentials("nope", "longenough")).toMatch(/email/);
    expect(validateCredentials("a@b.co", "short")).toMatch(/8 characters/);
    expect(validateCredentials("a@b.co", "longenough")).toBeNull();
  });

  it("signs in, reads back and signs out", () => {
    const user = signInLocally("Astro.Student@Example.org");
    expect(user.email).toBe("astro.student@example.org");
    expect(readSession()?.id).toBe(user.id);
    signOutLocally();
    expect(readSession()).toBeNull();
  });
});
