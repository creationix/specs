new ExploreRecursive(5,
    new ExploreFields({
        tree: new ExploreRecursive(new RecursionLimit_None(),
            new ExploreAll(new ExploreRecursiveEdge())
        ),
        parents: new ExploreAll(new ExploreRecursiveEdge())
    })
)
