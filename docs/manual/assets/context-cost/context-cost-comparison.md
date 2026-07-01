# OASIS Context Cost Dry Run

This report is generated offline from historical SQLite `run.db` files and does not call any LLM.

## DeepSeek Actual Usage

- API requests: 719
- Total tokens: 46,297,315
- Input cache hit: 14,159,232
- Input cache miss: 31,824,521
- Output: 313,562
- Estimated actual cost: 102.72 RMB

## Aggregate Estimate

- Historical refresh requests in DBs: 560
- Old full-context estimate: 42,538,328 tokens
- Attention-budget estimate: 1,338,304 tokens
- Estimated reduction: 96.85%
- Old estimate vs DeepSeek actual: -8.12% error
- Attention estimate vs DeepSeek actual: -97.11% delta

![cost comparison](context-cost-comparison.svg)

## Per Run

| run.db | requests | old tokens | attention tokens | old RMB all miss | attention RMB all miss |
|---|---:|---:|---:|---:|---:|
| 1d847f72d572460c9682439c2369e3a9 | 168 | 7,765,296 | 404,217 | 24.49 | 1.27 |
| cf01392bb08645d58a2d9dfa4d80972d | 56 | 116,368 | 119,280 | 0.37 | 0.38 |
| f67df8c372334dbca20644c2ab3dc5ef | 280 | 34,540,296 | 695,527 | 108.93 | 2.19 |
| f8f7e73771de48f7a4e8f47401372db0 | 56 | 116,368 | 119,280 | 0.37 | 0.38 |

## Model

Old full-context cost grows with accumulated comments visible in each refresh trace.

```text
Old:       Total ~= sum_t A_t * (B + visible_posts_t + all_visible_comments_t)
Attention: Total <= sum_t A_t * (B + seed_panel + bounded_comment_budget)
```

After bounding comment context, historical comment count affects deterministic panel counts and selection, not prompt size directly.
