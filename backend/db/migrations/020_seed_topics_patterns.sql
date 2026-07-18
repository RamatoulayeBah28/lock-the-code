-- Additional topics
INSERT INTO topics (topic) VALUES
  ('Matrix'),
  ('Math & Geometry'),
  ('Intervals'),
  ('Trie'),
  ('Bit Manipulation')
ON CONFLICT (topic) DO NOTHING;

-- Additional patterns
INSERT INTO patterns (pattern) VALUES
  ('In-place Reversal'),
  ('Fast & Slow Pointers'),
  ('Greedy'),
  ('Sorting'),
  ('Recursion'),
  ('Monotonic Stack'),
  ('Union Find'),
  ('Divide & Conquer'),
  ('Merge Intervals'),
  ('1-D Dynamic Programming'),
  ('Advanced Graphs'),
  ('Multiple Pass'),
  ('Temporary Head')
ON CONFLICT (pattern) DO NOTHING;
