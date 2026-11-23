import "@testing-library/jest-dom";
import React from "react";

// Polyfill URL.createObjectURL and URL.revokeObjectURL for jsdom environment
if (typeof window !== "undefined") {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => "blob:http://localhost/mock-blob-url");
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  }
  if (window.HTMLMediaElement) {
    window.HTMLMediaElement.prototype.load = jest.fn();
    window.HTMLMediaElement.prototype.play = jest.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = jest.fn();
  }
}

// Mock next/image without JSX so .ts files parse cleanly
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    const { fill: _fill, unoptimized: _unopt, priority: _prio, ...rest } = props;
    return React.createElement("img", rest);
  },
}));

// Mock next/navigation for Jest environment
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  })),
}));
