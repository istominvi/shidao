import assert from "node:assert/strict";
import test from "node:test";
import { extractComponentStoredFileReferences } from "./stored-file-references";

const FILE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const IMAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

test("image and file payloads omit an unselected StoredFile", () => {
  assert.deepEqual(
    extractComponentStoredFileReferences("image", {
      storedFileId: null,
      alt: "",
    }),
    [],
  );
  assert.deepEqual(
    extractComponentStoredFileReferences("file", {
      storedFileId: null,
      label: "Файл",
      openMode: "download",
    }),
    [],
  );
});

test("image and file payloads return their selected StoredFile", () => {
  assert.deepEqual(
    extractComponentStoredFileReferences("image", {
      storedFileId: IMAGE_ID,
      alt: "Схема",
    }),
    [IMAGE_ID],
  );
  assert.deepEqual(
    extractComponentStoredFileReferences("file", {
      storedFileId: FILE_ID,
      label: "Рабочий лист",
      openMode: "preview",
    }),
    [FILE_ID],
  );
});

test("slideshow references preserve payload order and duplicate occurrences", () => {
  assert.deepEqual(
    extractComponentStoredFileReferences("slideshow", {
      slides: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          storedFileId: IMAGE_ID,
          alt: "Первый показ",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          storedFileId: FILE_ID,
          alt: "Другой файл",
        },
        {
          id: "33333333-3333-4333-8333-333333333333",
          storedFileId: IMAGE_ID,
          alt: "Повторный показ",
        },
      ],
      autoplay: false,
    }),
    [IMAGE_ID, FILE_ID, IMAGE_ID],
  );
});

test("components without StoredFile fields return an empty list", () => {
  assert.deepEqual(
    extractComponentStoredFileReferences("heading", {
      text: "Тема урока",
      level: "h2",
    }),
    [],
  );
});

test("invalid registry payloads fail instead of hiding malformed references", () => {
  assert.throws(() =>
    extractComponentStoredFileReferences("image", {
      storedFileId: "not-a-uuid",
      alt: "Схема",
    }),
  );
});
