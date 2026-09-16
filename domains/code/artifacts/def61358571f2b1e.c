/*
PROBLEM: Given the root of a binary tree, return its maximum depth: the number of nodes
on the longest path from the root down to a leaf. An empty tree has depth 0.

EXAMPLES:
  tree [3, 9, 20, null, null, 15, 7]  ->  3
  tree [1, null, 2]                   ->  2
*/

#include <stddef.h>

struct TreeNode {
    int val;
    struct TreeNode *left;
    struct TreeNode *right;
};

int maxDepth(struct TreeNode *root)
{
    if (root == NULL)
        return 0;

    int left = maxDepth(root->left);
    int right = maxDepth(root->right);

    return 1 + (left > right ? left : right);
}
