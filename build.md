Steps to build

Pull Container Local
Copy .env.template to .env
Update with OPENAI_API_KEY and OPENAI_API_ORG_ID

build docker container:


docker build --platform linux/amd64 . -t 230172922685.dkr.ecr.us-east-1.amazonaws.com/chatgpt
 
tag instances
docker tag 230172922685.dkr.ecr.us-east-1.amazonaws.com/chatgpt  230172922685.dkr.ecr.us-east-1.amazonaws.com/chatgpt:<version>

Push Containers to AWS

login to Adthrive AWS

 saml2aws login

login to ECR
 aws ecr get-login-password --region us-east-1 --profile saml| docker login --username AWS --password-stdin 230172922685.dkr.ecr.us-east-1.amazonaws.com
Push Images 

 docker push 230172922685.dkr.ecr.us-east-1.amazonaws.com/chatgpt
 docker push 230172922685.dkr.ecr.us-east-1.amazonaws.com/chatgpt:<version>


Confirm in Adthrive Console
