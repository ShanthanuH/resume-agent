import { describe, expect, it } from "vitest";
import { isSkin, pickSkin, sitePath } from "./skin";

describe("pickSkin", () => {
  it("takes ?design= first", () => {
    expect(pickSkin("bold", "calm", "calm")).toBe("bold");
    expect(pickSkin("calm", "bold", "bold")).toBe("calm");
  });

  it("then the cookie, then the deployment's default", () => {
    expect(pickSkin(null, "bold", "calm")).toBe("bold");
    expect(pickSkin(null, undefined, "bold")).toBe("bold");
    expect(pickSkin(null, undefined, "calm")).toBe("calm");
  });

  it("ignores values that are not a skin", () => {
    expect(pickSkin("loud", "paper", "calm")).toBe("calm");
    expect(isSkin("")).toBe(false);
    expect(isSkin(undefined)).toBe(false);
  });
});

describe("sitePath", () => {
  it("drops the skin folder from a built page's address", () => {
    expect(sitePath("/calm")).toBe("/");
    expect(sitePath("/bold/try")).toBe("/try");
    expect(sitePath("/calm/states/done")).toBe("/states/done");
  });

  it("leaves the visitor's own address alone", () => {
    expect(sitePath("/")).toBe("/");
    expect(sitePath("/try")).toBe("/try");
    expect(sitePath("/calmer")).toBe("/calmer");
  });
});
