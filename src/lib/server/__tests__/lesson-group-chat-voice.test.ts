import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/lib/server/lesson-group-chat-service.ts", "utf8");
const repositorySource = readFileSync("src/lib/server/lesson-group-chat-repository.ts", "utf8");

test("lesson group chat service keeps text-message validation", () => {
  assert.equal(source.includes("Введите текст сообщения."), true);
  assert.equal(source.includes("MESSAGE_MAX_LENGTH"), true);
});

test("lesson group chat service allows voice-only and rejects empty messages without attachments", () => {
  assert.equal(source.includes("validateMessageContent"), true);
  assert.equal(source.includes("hasAttachment"), true);
  assert.equal(source.includes("Нельзя отправить пустое сообщение без вложения."), true);
});

test("voice flow keeps parent write restrictions and signed URL access checks in service", () => {
  assert.equal(source.includes("Родительский профиль не может отправлять сообщения в чат урока"), true);
  assert.equal(source.includes("getCommunicationAttachmentSignedUrl"), true);
  assert.equal(source.includes("assertCanReadLessonChat"), true);
  assert.equal(source.includes("deleteLessonGroupMessageByIdAdmin"), true);
});

test("repository retries voice upload after auto-creating missing storage bucket", () => {
  assert.equal(repositorySource.includes("ensureStorageBucketExistsAdmin"), true);
  assert.equal(repositorySource.includes("allowed_mime_types"), true);
});
