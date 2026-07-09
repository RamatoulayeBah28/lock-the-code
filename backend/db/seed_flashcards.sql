-- System flashcards (author_id IS NULL = pre-seeded, visible to all Pro users)
-- Front: problem title + statement (identify the pattern)
-- Back: pattern name + key insight + approach

INSERT INTO flashcards (author_id, pattern_id, front, back) VALUES

-- Hash Map
(NULL, (SELECT id FROM patterns WHERE pattern = 'Hash Map'),
 'Two Sum — Given an array of integers and a target, return the indices of the two numbers that add up to the target. Assume exactly one solution exists.',
 'Hash Map — As you iterate, store each number''s index in a map. For each number, check if (target - number) is already in the map. O(n) time, O(n) space.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Hash Map'),
 'Group Anagrams — Given a list of strings, group all strings that are anagrams of each other.',
 'Hash Map — Sort each string alphabetically to get a canonical key (e.g. "eat" → "aet"). Group strings with the same sorted key. O(n · k log k) where k is max string length.'),

-- Sliding Window
(NULL, (SELECT id FROM patterns WHERE pattern = 'Sliding Window'),
 'Longest Substring Without Repeating Characters — Given a string, find the length of the longest substring that contains no duplicate characters.',
 'Sliding Window — Expand the right pointer; when a duplicate enters the window, shrink from the left until the window is valid. Track current characters in a hash set. O(n) time.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Sliding Window'),
 'Maximum Sum Subarray of Size K — Given an array of integers and a number k, find the maximum sum of any contiguous subarray of size k.',
 'Fixed Sliding Window — Add the incoming right element, subtract the outgoing left element. Track the running sum and update the max. Window size stays constant at k. O(n) time.'),

-- Two Pointers
(NULL, (SELECT id FROM patterns WHERE pattern = 'Two Pointers'),
 'Two Sum II (Sorted Array) — Given a sorted array, find two numbers that add up to a target. Return their 1-indexed positions.',
 'Two Pointers — Left pointer starts at index 0, right at the end. If sum < target move left right; if sum > target move right left. Works because the array is sorted. O(n) time, O(1) space.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Two Pointers'),
 'Container With Most Water — Given n vertical lines of varying heights, find the two lines that together with the x-axis holds the most water.',
 'Two Pointers — Start at both ends. Area = min(height[l], height[r]) * (r - l). Always move the shorter pointer inward — moving the taller one can only decrease area. O(n) time.'),

-- Binary Search
(NULL, (SELECT id FROM patterns WHERE pattern = 'Binary Search'),
 'Search in Rotated Sorted Array — A sorted array was rotated at an unknown pivot. Given a target, return its index or -1 if not found.',
 'Binary Search — At each mid, one half is always sorted. Determine which half is sorted, check if target falls in that range, then eliminate the other half. O(log n) time.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Binary Search'),
 'Find Minimum in Rotated Sorted Array — Find the minimum element in a rotated sorted array with no duplicates.',
 'Binary Search — If nums[mid] > nums[right], the minimum is in the right half. Otherwise it''s in the left half (mid included). Stop when lo == hi. O(log n) time.'),

-- DFS
(NULL, (SELECT id FROM patterns WHERE pattern = 'DFS'),
 'Number of Islands — Given a 2D grid of "1" (land) and "0" (water), count the number of islands. An island is surrounded by water and formed by connecting adjacent land cells.',
 'DFS — For each unvisited "1", run a DFS that marks all connected land cells as visited. Each DFS invocation = one island. Time and space O(m × n).'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'DFS'),
 'Clone Graph — Given a node in a connected undirected graph, return a deep copy of the entire graph.',
 'DFS + Hash Map — Map original node → its clone. If a node is already in the map, return the clone. Otherwise create the clone, then recursively clone all neighbors. O(V + E) time.'),

-- BFS
(NULL, (SELECT id FROM patterns WHERE pattern = 'BFS'),
 'Binary Tree Level Order Traversal — Return the values of a binary tree level by level, from left to right.',
 'BFS — Use a queue. At the start of each iteration, the queue holds exactly one level. Process all nodes at that level, enqueue their children, then move to the next level. O(n) time.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'BFS'),
 'Shortest Path in Binary Matrix — Given an n×n binary matrix, find the shortest clear path (only 0s) from top-left to bottom-right. Return -1 if none exists.',
 'BFS — BFS guarantees the shortest path in an unweighted graph. Start from (0,0), explore all 8 directions, mark visited cells to avoid revisiting. O(n²) time.'),

-- Heap
(NULL, (SELECT id FROM patterns WHERE pattern = 'Heap'),
 'Kth Largest Element in an Array — Find the kth largest element in an unsorted array without fully sorting it.',
 'Min-Heap of size k — Push elements one by one. When heap size exceeds k, pop the minimum. The heap root is always the kth largest seen so far. O(n log k) time.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Heap'),
 'Top K Frequent Elements — Given an integer array, return the k most frequent elements.',
 'Hash Map + Min-Heap — Count frequencies with a hash map, then maintain a min-heap of size k keyed by frequency. Anything smaller than the heap root gets discarded. O(n log k) time.'),

-- Backtracking
(NULL, (SELECT id FROM patterns WHERE pattern = 'Backtracking'),
 'Subsets — Given a set of distinct integers, return all possible subsets (the power set), including the empty set.',
 'Backtracking — At each step, choose to include or exclude the current element, then recurse on the next. Add a copy of the current subset to results at every node (not just leaves). O(2ⁿ) subsets.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Backtracking'),
 'Permutations — Given an array of distinct integers, return all possible permutations.',
 'Backtracking — Swap the current index with each remaining element, recurse to build the rest of the permutation, then swap back (backtrack). Base case: index == len(nums). O(n!) permutations.'),

-- Prefix/Suffix
(NULL, (SELECT id FROM patterns WHERE pattern = 'Prefix/Suffix'),
 'Product of Array Except Self — Given an integer array, return an array where output[i] is the product of all elements except nums[i]. No division allowed, O(n) time.',
 'Prefix + Suffix Products — First pass: build prefix products left to right. Second pass: multiply each position by the running suffix product right to left. O(n) time, O(1) extra space.'),

-- Hash Set
(NULL, (SELECT id FROM patterns WHERE pattern = 'Hash Set'),
 'Longest Consecutive Sequence — Given an unsorted array of integers, find the length of the longest sequence of consecutive integers.',
 'Hash Set — Add all numbers to a set. For each number where (num - 1) is NOT in the set, it''s a sequence start. Count forward from there. O(n) time — each element is visited at most twice.'),

-- Stack
(NULL, (SELECT id FROM patterns WHERE pattern = 'Stack'),
 'Valid Parentheses — Given a string containing only ''('', '')'', ''{'', ''}'', ''['' and '']'', determine if the input string is valid. Open brackets must be closed in the correct order.',
 'Stack — Push open brackets onto the stack. For each closing bracket, check if the top of the stack is the matching opener. If not, or if the stack is empty, invalid. Valid if stack is empty at the end.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Stack'),
 'Daily Temperatures — Given an array of temperatures, return an array where result[i] is the number of days until a warmer temperature. If no warmer day exists, put 0.',
 'Monotonic Stack — Maintain a stack of indices with decreasing temperatures. For each new temperature, pop all indices with a colder temperature and record the difference. O(n) time.'),

-- Queue
(NULL, (SELECT id FROM patterns WHERE pattern = 'Queue'),
 'Number of Recent Calls — Implement a class that counts the number of requests in the last 3000 milliseconds. Each call to ping(t) adds a new request at time t.',
 'Queue — Add each new timestamp to a queue. Pop from the front while the oldest timestamp is more than 3000ms ago. The queue size is the answer. O(1) amortized per ping.'),

(NULL, (SELECT id FROM patterns WHERE pattern = 'Queue'),
 'Task Scheduler — Given a list of CPU tasks and a cooldown n, find the minimum number of intervals needed to complete all tasks. Identical tasks must be separated by at least n intervals.',
 'Queue + Heap — Use a max-heap by frequency. At each cycle, greedily pick the most frequent available task. Use a queue to hold tasks on cooldown with their release time. O(n) time.');
