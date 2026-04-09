import { describe, it, expect, beforeEach } from "vitest";
import { env } from "cloudflare:test";
import { fetchApp, createTestUser, createTestPet, authHeader } from "../helpers";
import type { PetRow } from "../../src/lib/db";

let token: string;
let userId: string;

beforeEach(async () => {
  await env.DB.exec("DELETE FROM report_values;");
  await env.DB.exec("DELETE FROM reports;");
  await env.DB.exec("DELETE FROM pets;");
  await env.DB.exec("DELETE FROM users;");

  const user = await createTestUser();
  token = user.token;
  userId = user.userId;
});

describe("GET /pets", () => {
  it("returns empty list when no pets", async () => {
    const res = await fetchApp("/pets", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json<{ pets: PetRow[] }>();
    expect(body.pets).toHaveLength(0);
  });

  it("returns user's pets", async () => {
    await createTestPet(userId, "米寶");

    const res = await fetchApp("/pets", { headers: authHeader(token) });
    expect(res.status).toBe(200);
    const body = await res.json<{ pets: PetRow[] }>();
    expect(body.pets).toHaveLength(1);
    expect(body.pets[0].name).toBe("米寶");
  });

  it("returns 401 without auth", async () => {
    const res = await fetchApp("/pets");
    expect(res.status).toBe(401);
  });
});

describe("POST /pets", () => {
  it("creates a pet", async () => {
    const res = await fetchApp("/pets", {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "米寶", species: "貓", breed: "Maine Coon" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json<{ pet: PetRow }>();
    expect(body.pet.name).toBe("米寶");
    expect(body.pet.species).toBe("貓");
    expect(body.pet.breed).toBe("Maine Coon");
  });

  it("returns 400 for missing fields", async () => {
    const res = await fetchApp("/pets", {
      method: "POST",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "米寶" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json<{ error: string }>();
    expect(body.error).toBe("missing_fields");
  });
});

describe("GET /pets/:id", () => {
  it("returns a specific pet", async () => {
    const petId = await createTestPet(userId);
    const res = await fetchApp(`/pets/${petId}`, {
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ pet: PetRow }>();
    expect(body.pet.id).toBe(petId);
  });

  it("returns 404 for non-existent pet", async () => {
    const res = await fetchApp("/pets/nonexistent", {
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for other user's pet", async () => {
    const petId = await createTestPet(userId);
    const other = await createTestUser("other@test.com");
    const res = await fetchApp(`/pets/${petId}`, {
      headers: authHeader(other.token),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /pets/:id", () => {
  it("updates pet fields", async () => {
    const petId = await createTestPet(userId);
    const res = await fetchApp(`/pets/${petId}`, {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "米寶寶", breed: "Mixed" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ pet: PetRow }>();
    expect(body.pet.name).toBe("米寶寶");
    expect(body.pet.breed).toBe("Mixed");
    // Unchanged fields preserved
    expect(body.pet.species).toBe("貓");
  });

  it("returns 404 for non-existent pet", async () => {
    const res = await fetchApp("/pets/nonexistent", {
      method: "PATCH",
      headers: { ...authHeader(token), "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /pets/:id", () => {
  it("soft deletes a pet", async () => {
    const petId = await createTestPet(userId);
    const res = await fetchApp(`/pets/${petId}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(200);
    const body = await res.json<{ ok: boolean }>();
    expect(body.ok).toBe(true);

    // Verify not returned in list
    const listRes = await fetchApp("/pets", { headers: authHeader(token) });
    const list = await listRes.json<{ pets: PetRow[] }>();
    expect(list.pets).toHaveLength(0);
  });

  it("returns 404 for non-existent pet", async () => {
    const res = await fetchApp("/pets/nonexistent", {
      method: "DELETE",
      headers: authHeader(token),
    });
    expect(res.status).toBe(404);
  });
});
