Let's start with a simplified version of the core git data model implemented as native IPLD.

```ipldsch
type Object union {
    | Tag "tag"
    | Commit "commit"
    | Tree "tree"
    | Blob "blob"
} representation keyed

type Type enum {
    | Tree "tree"
    | Blob "blob"
    | Commit "commit"
    | Tag "tag"
}

type Tag struct {
  message String
  type    Type
  link    @Object
}

type Commit struct {
    message   String
    tree      &Tree
    parents   [&Object]
}

type Mode enum {
  | Tree   ("16384") # 0o040000
  | Blob   ("33188") # 0o100644
  | File   ("33188") # 0o100644
  | Exec   ("33261") # 0o100755
  | Sym    ("40960") # 0o120000
  | Commit ("57344") # 0o160000
} representation int

type Entry struct {
    name String
    mode Mode
    link @Object
}

type Tree [Entry]

type Blob Bytes
```

Let's start with some sample IPLD blocks for the last few commits we want to fetch:
```js
// CID: COMMIT1
{ commit: {
    message: "Test Commit",
    tree: TREE1,
    parents: [COMMIT2]
}}

// CID: COMMIT2
{ commit: {
    message: "Merge Commit",
    TREE: TREE2,
    parents: [COMMIT3, COMMIT4]
}}

// CID: COMMIT3
{ commit: {
    message: "Feature Branch",
    TREE: TREE3,
    parents: [COMMIT5]
}}

// CID: COMMIT4
{ commit: {
    message: "Master Branch",
    TREE: TREE4,
    parents: [COMMIT6]
}}
///...
```

Now for some trees:
```js
// This is like an initial commit for a new project
// CID: TREE3
{ tree: [
    { name: "README.md", mode: Mode.File, link: BLOB1 },
]}

// These two added a src folder containing a single file
// CID: TREE2
{ tree: [
    { name: "README.md", mode: Mode.File, link: BLOB1 },
    { name: "src", mode: Mode.Tree, link: TREE10 },
]}
// CID: TREE10
{ tree: [
    { name: "main.zig", mode: Mode.File, link: BLOB2 },
]}

// This added a git submodule and modified the README.
// CID: TREE1
{ tree: [
    { name: "README.md", mode: Mode.File, link: BLOB1_2 },
    { name: "src", mode: Mode.Tree, link: TREE10 },
    { name: ".gitmodules", mode: Mode.File, link: BLOB10 },
    { name: "libhydrogen", mode: Mode.Commit, link: COMMIT10 },
]}
//...
```

## Selector for Shallow Clone

So now for the tricky part.  I want a selector that simulates a shallow git clone.  This means:
- Recursively follow the `parents` list in each commit up to a given depth.
- Recursively follow tree links witout depth limit.
- Don't follow submodules, these appear as tree entries where `type: Mode.commit`
- I don't want multiple copies of `BLOB1`, `TREE10`, and `BLOB2` even though they appear in more than one place in the graph.

How can selectors do this?