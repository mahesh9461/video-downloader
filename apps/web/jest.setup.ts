import "@testing-library/jest-dom";

// Polyfill URL.createObjectURL and URL.revokeObjectURL for jsdom environment
if (typeof window !== "undefined") {
  if (!window.URL.createObjectURL) {
    window.URL.createObjectURL = jest.fn(() => "blob:http://localhost/mock-blob-url");
  }
  if (!window.URL.revokeObjectURL) {
    window.URL.revokeObjectURL = jest.fn();
  }
}

