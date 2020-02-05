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
    tree: TREE2,
    parents: [COMMIT3, COMMIT4]
}}

// CID: COMMIT3
{ commit: {
    message: "Feature Branch",
    tree: TREE3,
    parents: [COMMIT5]
}}

// CID: COMMIT4
{ commit: {
    message: "Master Branch",
    tree: TREE4,
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


The graph looks something like this when presented with links inline:

## data as raw JSON
```js
// CID: COMMIT1
{ commit: { 
  message: "Test Commit",
  tree: // CID: TREE1
    { tree: { 
      { name: "README.md", mode: Mode.File, link: 
        // CID: BLOB1_2 ...
      },
      { name: "src", mode: Mode.Tree, link:
        // CID: TREE10
        { tree: [
          { name: "main.zig", mode: Mode.File, link: 
            // CID: BLOB2 ...
          },
        ]}
      },
      { name: ".gitmodules", mode: Mode.File, link: 
        // CID: BLOB10 ...
      },
      { name: "libhydrogen", mode: Mode.Commit, link: 
        // CID: COMMIT10 ...
      },
    }},
  parents: [
    // CID: COMMIT2
    { commit: {
      message: "Merge Commit",
      tree: // CID: TREE2
        { tree: {
          { name: "README.md", mode: Mode.File, link: 
            // CID: BLOB1 ...
          },
          { name: "src", mode: Mode.Tree, link:
            // CID: TREE10
            { tree: [
              { name: "main.zig", mode: Mode.File, link: 
                // CID: BLOB2 ...
              },
            ]}
          },
        }},
      parents: [
        // CID: COMMIT3
        { commit: {
          message: "Feature Branch",
          tree: 
            // CID: TREE3
            { tree: [
                { name: "README.md", mode: Mode.File, link: 
                  // CID: BLOB1 ...
                },
            ]}
          parents: [
            // CID: COMMIT5 ...
          ]
        }},
        // CID: COMMIT4
        { commit: {
          message: "Master Branch",
          tree: 
            // CID: TREE4 ...
          parents: [
            // CID: COMMIT6 ...
          ]
        }},
      ]  
    }}
  ]
}}
```

## data as schema typed yaml
```yaml
Object: # COMMIT1
  Commit:
    message: Test Commit
    tree: 
      Object: # TREE1
        Tree:
          - Entry:
            name: README.md
            mode: Mode.File
            link: 
              Object: # BLOB1_2 ...
          - Entry:
            name: src
            mode: Mode.Tree
            link:
              Object: # TREE10
                Tree:
                  - Entry:
                    name: main.zig
                    mode: Mode.File
                    link: 
                      Object: # BLOB2 ...
          - Entry:
            name: .gitmodules
            mode: Mode.File
            link: 
              Object: # BLOB10 ...
          - Entry:
            name: libhydrogen
            mode: Mode.Commit
            link: 
              Object: # COMMIT10 ...
    parents:
      - Object: # COMMIT2
        Commit:
          message: Merge Commit
          tree: 
            Object: # TREE2
              Tree:
                - Entry:
                  name: README.md
                  mode: Mode.File
                  link:
                    Object: # BLOB1 ...
                - Entry:
                  name: src
                  mode: Mode.Tree
                  link:
                    Object: # TREE10
                      Tree:
                        - Entry:
                          name: main.zig
                          mode: Mode.File
                          link:
                            Object: # BLOB2
      parents:
        - Object: # COMMIT3
          Commit:
            message: Feature Branch
            tree: 
              - Object: # TREE3
                Tree:
                  name: README.md
                  mode: Mode.File
                  link: 
                    Object: # BLOB1 ...
            parents:
              - Object: # COMMIT5 ...
        - Object: # COMMIT4
          Commit:
            message: Master Branch
            tree: 
              Object: # TREE4 ...
            parents:
              Object: # COMMIT6
```

## Selector for Shallow Clone

So now for the tricky part.  I want a selector that simulates a shallow git clone.  This means:
- Recursively follow the `parents` list in each commit up to a given depth.
- Recursively follow tree links witout depth limit.
- Don't follow submodules, these appear as tree entries where `type: Mode.commit`
- I don't want multiple copies of `BLOB1`, `TREE10`, and `BLOB2` even though they appear in more than one place in the graph.

How can selectors do this?

Let's start with this:
```yaml
# starting from a commit
Selector:
  ExploreRecursive:
    maxDepth: 5 ## this is the shallow clone depth
    sequence:
      ExploreFields:
        fields:
          "tree":
            ExploreRecursive:
              maxDepth: 9999 ## we don't actually allow this field to be absent (reasons similar to graphql's refusal of recursion)
              sequence:
                ExploreAll:
                  next:
                    ExploreRecursiveEdge
          "parents":
              ExploreAll:
                next:
                  ExploreRecursiveEdge ## jumps us back up to the top
```

How does this syntax look:
```closurescript
(Commit
  message="Test Commit"
  tree=<Tree: # TREE1
    Entry: name="README.md" mode=File link=Blob:
      ... # BLOB1_2
    Entry: name="src" mode=Tree link=Tree( # TREE10
      Entry(name="main.zig" mode=File link=Blob(...)))) # BLOB2
    Entry(name=".gitmodules" mode=File link=Blob(...)) # BLOB10
    Entry(name=".libhydrogen" mode=Commit link=Commit(...))) # COMMIT10
  parents:[
    Commit( # COMMIT2
      message:"Merge Commit"
      tree:Tree( # TREE2
        Entry(name="README.md" mode=File link=Blob(...)) # BLOB1
        Entry(name="src" mode=Tree link=Tree( # TREE10
          Entry(name="main.zig" mode=File link=Blob(...))))) # BLOB2
      parents:[
        Commit( # COMMIT 3
          message:"Feature Branch"
          tree:Tree( # TREE3
            Entry(name="README.md" mode=File link=Blob(...))) # BLOB1
          parents:[
            Commit(...)]) # COMMIT5
        Commit( # COMMIT 4
```

## Url Friendly Generalized Syntax

```js
// Finding out what characters are URL friendly so we know what to work with.
> new Array(256).join('.').split('.').map((_,i)=>String.fromCharCode(i)).filter(i=>encodeURIComponent(i)===i&&encodeURI(i)===i)
[
  '!', "'", '(', ')', '*', '-', '.', '0', '1',
  '2', '3', '4', '5', '6', '7', '8', '9', 'A',
  'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J',
  'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S',
  'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '_', 'a',
  'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's',
  't', 'u', 'v', 'w', 'x', 'y', 'z', '~'
]
```

This is a sample selector as it would appear embedded in a URL as a long line:

```java
Selector(ExploreRecursive(maxDepth(5)sequence(ExploreFields(fields(tree(ExploreRecursive(maxDepth(9999)sequence(ExploreAll(next(ExploreRecursiveEdge())))))parents(ExploreAll(next(ExploreRecursiveEdge()))))))))
```

Here, it's shown with whitespace added.  Notice that every line ends in punctuation so whitespace is never needed.

```java
// starting from a commit
Selector(
  ExploreRecursive(
    maxDepth(5) // this is the shallow clone depth
    sequence(
      ExploreFields(
        fields(
          tree(
            ExploreRecursive(
              maxDepth(9999) // we don't actually allow this field to be absent (reasons similar to graphql's refusal of recursion)
              sequence(
                ExploreAll(
                  next(
                    ExploreRecursiveEdge())))))
          parents(
            ExploreAll(
              next(
                ExploreRecursiveEdge()))))))))
```

For comparison, here is the YAML version.

```yaml
# starting from a commit
Selector:
  ExploreRecursive:
    maxDepth: 5 ## this is the shallow clone depth
    sequence:
      ExploreFields:
        fields:
          "tree":
            ExploreRecursive:
              maxDepth: 9999 ## we don't actually allow this field to be absent (reasons similar to graphql's refusal of recursion)
              sequence:
                ExploreAll:
                  next:
                    ExploreRecursiveEdge
          "parents":
              ExploreAll:
                next:
                  ExploreRecursiveEdge ## jumps us back up to the top
```

Let's try to make it more terse and readable.  All schema types have fixed arity in selectors, so we can omit property names.
This also reduces the amount of parentheses considerably.  We add `.` as a separater between arguments that don't end in symbols already.
Also don't require symbols for leaves like `ExploreRecursiveEdge`.

One liner in more terse version.
```java
Selector(ExploreRecursive(5.ExploreFields(tree(ExploreRecursive(9999.ExploreAll(ExploreRecursiveEdge)))parents(ExploreAll(ExploreRecursiveEdge)))))
```


Same thing pretty-printed.
```
Selector(
  ExploreRecursive(
    5.
    ExploreFields(
      tree(
        ExploreRecursive(
          9999.
          ExploreAll(
            ExploreRecursiveEdge
          )
        )
      )
      parents(
        ExploreAll(
          ExploreRecursiveEdge
        )
      )
    )
  )
)
```

Now let's shorten the struct and enum names to make the syntax selector specific.

```
Selector -> (none, it's implied)
Matcher -> m
ExploreAll -> *
ExploreFields -> f
ExploreIndex -> i
ExploreRange -> r
ExploreRecursive -> R
ExploreUnion -> -
ExploreConditional -> !
ExploreRecursiveEdge -> ~
```

```java
R(
  5.
  f(
    'tree'(
      R(
        9999.
        *(
          ~
        )
      )
    )
    'parents'(
      *(
        ~
      )
    )
  )
)
```

```java
R(5.f('tree'(R(9999.a(~)))'parents'(a(~))))
```

## Example Selectors ported to terse syntax

```java
f('characters'(
  f('kathryn-janeway'(
    f('birthday'(
      f('year'(.))
    ))
  ))
))
```

```java
f('characters'(f('kathryn-janeway'(f('birthday'(f('year'(.))))))))
```

## Compound paths.

If we allow use of `/` (which is mostly safe in URLs as long it's not used as a path segment) We can optimize for this pattern by creating a new `F` type that accepts compound paths.

```java
F('characters/kathryn-janeway/birthday/year'(.))
```
