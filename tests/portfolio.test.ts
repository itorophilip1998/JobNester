import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyState,
  portfolioDefaults,
  productLink,
  publicAssetReferences,
} from "@jobnester/core";
test("existing portfolio records receive backward-compatible design defaults", () => {
  const p = portfolioDefaults(emptyState().portfolio);
  assert.equal(p.layout, "studio");
  assert.equal(p.motion, "subtle");
  assert.equal(p.sectionOrder?.length, 5);
  assert.deepEqual(p.certifications, []);
});
test("live product URL takes precedence over its repository fallback", () => {
  const p = {
    id: "p",
    title: "Product",
    description: "",
    tags: [],
    url: "https://product.example",
    repositoryUrl: "https://github.com/example/repo",
    image: "",
  };
  assert.equal(productLink(p), p.url);
  assert.equal(productLink({ ...p, url: "" }), p.repositoryUrl);
  assert.equal(productLink({ ...p, url: "", repositoryUrl: "" }), "");
});
test("only explicit published résumé, project, portrait and certificate files become public", () => {
  const p = {
    ...emptyState().portfolio,
    avatar: "portrait",
    resume: { url: "cv", name: "CV" },
    projects: [
      {
        id: "p",
        title: "Project",
        description: "",
        url: "https://product.example",
        tags: [],
        image: "screenshot",
        video: "demo",
      },
    ],
    certifications: [
      {
        id: "c",
        name: "Certificate",
        issuer: "Issuer",
        issuedAt: "",
        description: "",
        credentialUrl: "https://issuer.example",
        image: "certificate",
      },
    ],
  };
  assert.deepEqual(publicAssetReferences(p), [
    "screenshot",
    "demo",
    "certificate",
    "cv",
    "portrait",
  ]);
  assert.ok(!publicAssetReferences(p).includes("https://product.example"));
});
