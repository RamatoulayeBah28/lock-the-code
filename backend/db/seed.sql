-- Seed common topics and patterns.
-- Use ON CONFLICT DO NOTHING so this is safe to re-run.

INSERT INTO topics (topic) VALUES
   ('Array'), 
   ('String'), 
   ('Linked List'), 
   ('Tree'), 
   ('Graph'), 
   ('Dynamic Programming'), 
   ('Hash Table'), 
   ('Stack'), 
   ('Queue')
ON CONFLICT DO NOTHING;

INSERT INTO patterns (pattern) VALUES
    ('Hash Map'),
    ('Sliding Window'),
    ('DFS'),
    ('BFS'),
    ('Heap'),
    ('Prefix/Suffix'),
    ('Binary Search'),
    ('Two Pointers'),
    ('Backtracking'),
    ('Hash Set'),
    ('Stack'),
    ('Queue')
ON CONFLICT DO NOTHING;
