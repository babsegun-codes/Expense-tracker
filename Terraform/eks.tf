resource "aws_eks_cluster" "expense-tracker" {
  name    = "expense-tracker"
  version = "1.36"

  access_config {
    authentication_mode = "API_AND_CONFIG_MAP"
  }


  role_arn = aws_iam_role.expense_tracker_cluster_role.arn


  vpc_config {
    subnet_ids = [
      aws_subnet.public_subnet_1.id,
      aws_subnet.public_subnet_2.id,
      aws_subnet.private_subnet_1.id,
      aws_subnet.private_subnet_2.id

    ]
  }
}

resource "aws_eks_node_group" "expense-tracker-node-group" {
  cluster_name    = aws_eks_cluster.expense-tracker.name
  node_group_name = "expense-tracker-node-group"
  node_role_arn   = aws_iam_role.expense_tracker_node_role.arn
  subnet_ids = [
    aws_subnet.private_subnet_1.id,
    aws_subnet.private_subnet_2.id
  ]

  scaling_config {
    desired_size = 2
    max_size     = 3
    min_size     = 1
  }

  instance_types = ["t3.medium"]
}

resource "aws_iam_role" "expense_tracker_cluster_role" {
  name = "expense-tracker-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "eks.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "expense_tracker_cluster_policy" {
  role       = aws_iam_role.expense_tracker_cluster_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role" "expense_tracker_node_role" {
  name = "expense-tracker-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"

    Statement = [
      {
        Effect = "Allow"

        Principal = {
          Service = "ec2.amazonaws.com"
        }

        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "expense_tracker_node_worker_policy" {
  role       = aws_iam_role.expense_tracker_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "expense_tracker_node_cni_policy" {
  role       = aws_iam_role.expense_tracker_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "expense_tracker_node_ecr_policy" {
  role       = aws_iam_role.expense_tracker_node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}


