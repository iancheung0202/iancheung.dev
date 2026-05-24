## Queries
```sql 
-- Basic SELECT
SELECT [col_names] AS [alias]
FROM [table]
WHERE [condition] -- filter rows before grouping
ORDER BY [col_name] [DESC]
LIMIT [number]
````

```sql
-- Inner Join
SELECT *
FROM [table1]
JOIN [table2]
    ON [table1.col = table2.col]
```

```sql
-- Self / Multi-condition Join
SELECT *
FROM [table1] AS [a]
JOIN [table2] AS [b]
    ON [a.col1 = b.col1]
    AND [a.col2 < b.col2]
```

```sql
-- Aggregation + Grouping
SELECT [group_col],
COUNT(*) AS total,
	MAX(col),
	MIN(col),
	SUM(col),
	AVG(col)
FROM [table]
GROUP BY [group_cols]
HAVING [condition] -- filter groups after aggregation
```
## Strings & Pattern Matching

```sql
"hello " || "world" -- concatenate --> "hello world"
[col] LIKE "%dog%" -- contains substring (case-insensitive in SQLite)
```
## Table Management

```sql
-- Create table
CREATE TABLE [table] (n, note);
CREATE TABLE [table] (n UNIQUE, note);

-- Create from another table
CREATE TABLE [new_table] AS
SELECT ... FROM [table] ...
```

```sql
-- Insert data
INSERT INTO [table]
VALUES (value1, value2),
	   (value3, value4)
```

```sql
-- Update rows
UPDATE [table]
SET [col] = [value]
WHERE [condition]
```

```sql
-- Delete rows but keep structure
DELETE FROM [table]
WHERE [condition]
```

```sql
-- Delete table entirely
DROP TABLE [table]
```
