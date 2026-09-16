/*
PROBLEM: Given the root of a binary tree, return its maximum depth: the number of nodes
on the longest path from the root down to a leaf. An empty tree has depth 0.

EXAMPLES:
  tree [3, 9, 20, null, null, 15, 7]  ->  3
  tree [1, null, 2]                   ->  2
*/

#include <stdio.h>
#include <stdlib.h>

struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};

static int maxDepth(struct TreeNode* root)
{
    if (root == NULL) {
        return 0;
    }
    int l = maxDepth(root->left) + 1;
    int r = maxDepth(root->right) + 1;
    return l > r ? l : r;
}

int main(void)
{
    printf("%d\n", maxDepth(NULL));
    return 0;
}
