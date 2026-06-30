# Lesson Step Authoring Template

**Status:** lightweight authoring helper  
**Scope:** new methodology lessons without database schema changes

Use the existing `methodology_lesson_block` table as the source step record.

```json
{
  "block_type": "guided_activity",
  "sort_order": 1,
  "title": "Название шага",
  "content": {
    "teacher": {
      "goal": "",
      "description": "",
      "actions": [],
      "expectedResponses": [],
      "materials": [],
      "notes": []
    },
    "student": {
      "componentKey": "placeholder_v1",
      "instruction": "",
      "payload": {}
    }
  }
}
```

Rules:

- Keep one row per visible lesson step.
- Keep teacher-private methodology in `content.teacher`.
- Put only learner-safe data in `content.student`.
- Use `componentKey` to choose the React renderer.
- Keep complex interaction behavior inside the React renderer, not in SQL.
- Store media/files in `reusable_asset` and reference them by id from payload or block assets.

Common component keys:

- `placeholder_v1` — offline or teacher-led step with no special UI.
- `section_renderer_v1` — render existing typed student sections.
- `lesson_focus_v1` — intro/focus step.
- `presentation_deck_v1` — slides/presentation.
- `media_asset_v1` — video/audio media.
- `flashcards_v1` — vocabulary cards.
- `phrase_cards_v1` — phrase cards.
- `count_board_v1` — counting/pointing task.
- `movement_cards_v1` — action cards or movement prompt.
- `matching_practice_v1` — simple matching cards.
- `worksheet_v1` — workbook/worksheet step.
- `farm_placement_v1` — farm placement activity.
- `song_player_v1` — song/listening step.

