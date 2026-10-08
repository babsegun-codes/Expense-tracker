output "vpc_id" {
  description = "The ID of the VPC to deploy resources in"
  type        = string
  value       = aws_vpc.expense_tracker_vpc.id

}

output "public_subnet_ids" {
  description = "List of public subnet IDs to deploy resources in"
  type        = list(string)
  value = [
    aws_subnet.public_subnet_1.id,
    aws_subnet.public_subnet_2.id
  ]

}

output "private_subnet_ids" {
  description = "List of private subnet IDs to deploy resources in"
  type        = list(string)
  value = [
    aws_subnet.private_subnet_1.id,
    aws_subnet.private_subnet_2.id
  ]

}

output "eks_cluster_name" {
  description = "The name of the EKS cluster"
  type        = string
  value       = aws_eks_cluster.expense-tracker.name
}

output "eks_node_group_name" {
  description = "The name of the EKS node group"
  type        = string
  value       = aws_eks_node_group.expense-tracker-node-group.node_group_name
}

output "eks_cluster_endpoint" {
  description = "The endpoint of the EKS cluster"
  type        = string
  value       = aws_eks_cluster.expense-tracker.endpoint
}

output "eks_cluster_arn" {
  description = "The ARN of the EKS cluster"
  type        = string
  value       = aws_eks_cluster.expense-tracker.arn
}

output "eks_node_group_arn" {
  description = "The ARN of the EKS node group"
  type        = string
  value       = aws_eks_node_group.expense-tracker-node-group.arn
}

output "eks_node_group_instance_types" {
  description = "The instance types of the EKS node group"
  type        = list(string)
  value       = aws_eks_node_group.expense-tracker-node-group.instance_types
}
